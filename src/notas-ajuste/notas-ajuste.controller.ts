import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus, BadRequestException, Res } from '@nestjs/common';
import { NotasAjusteService } from './notas-ajuste.service';
import { CreateNotaCreditoDto, CreateNotaDebitoDto, CreateNotasAjusteDto } from './dto/create-notas-ajuste.dto';
import { CreateNotaCreditoV2Dto } from './dto/create-nota-credito-v2.dto';
import { UpdateNotaCreditoV2Dto } from './dto/update-nota-credito-v2.dto';
import { UpdateNotasAjusteDto } from './dto/update-notas-ajuste.dto';
import { Req } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permission } from 'src/common/constants/roles.constants';
import { NotasAjusteFilterDto, toNotaAjusteResponse } from './dto/nota-ajuste-filter.dto';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Response } from 'express';
import { DisponibilidadNotaService } from './disponibilidad/disponibilidad-nota.service';
import { PaymentDetailsResolver, PaymentStrategyName } from './factus/payment-details.resolver';

@Controller('notas-ajuste')
@UseGuards(AuthGuard, RolesGuard)
export class NotasAjusteController {
  constructor(
    private readonly notasAjusteService: NotasAjusteService,
    private readonly disponibilidadService: DisponibilidadNotaService,
    private readonly paymentResolver: PaymentDetailsResolver,
  ) { }

  // ========== NOTAS CRÉDITO ==========

  /**
   * Crear Nota Crédito
   * 
   * POST /api/notas-ajuste/credito
   * 
   * Casos de uso:
   * - Devolución de productos
   * - Descuentos posteriores a la venta
   * - Anulación total o parcial
   * - Correcciones de precio
   */
  @Post('credito')
  @Permissions(Permission.INVOICE_CREATE)
  async crearNotaCredito(@Body() createDto: CreateNotaCreditoDto, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.crearNotaCredito(createDto, req.user.sub);

    return toNotaAjusteResponse(nota, 'Nota Crédito creada en borrador. Use /emitir para enviar a DIAN.');
  }

  /**
   * Crear Nota Crédito V2 (guía NC 2026).
   *
   * POST /api/notas-ajuste/credito/v2
   *
   * El concepto DIAN controla el cálculo: el body trae solo el input del
   * concepto (cantidad | precioNuevo | descuento | vacío=anulación) y el
   * backend recalcula todo. Sin formaPago: se espeja la factura.
   */
  @Post('credito/v2')
  @Permissions(Permission.INVOICE_CREATE)
  async crearNotaCreditoV2(@Body() createDto: CreateNotaCreditoV2Dto, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.crearNotaCreditoV2(createDto, req.user.sub);

    return toNotaAjusteResponse(nota, 'Nota Crédito V2 creada. Use /emitir para enviar a DIAN.');
  }

  /**
   * Listar solo Notas Crédito
   */
  @Get('credito')
  @Permissions(Permission.INVOICE_READ)
  async listarNotasCredito(@Query() filtros: NotasAjusteFilterDto) {
    filtros.tipo = 'credito' as any;
    const result = await this.notasAjusteService.findAll(filtros);

    return {
      success: true,
      message: 'Notas Crédito obtenidas',
      data: result.data,
      meta: result.meta
    };
  }

  // ========== NOTAS DÉBITO ==========

  /**
   * Crear Nota Débito
   * 
   * POST /api/notas-ajuste/debito
   * 
   * Casos de uso:
   * - Intereses de mora
   * - Gastos de cobranza
   * - Ajustes de precio (aumentos)
   * - Cargos adicionales
   */
  @Post('debito')
  @Permissions(Permission.INVOICE_CREATE)
  async crearNotaDebito(@Body() createDto: CreateNotaDebitoDto, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.crearNotaDebito(createDto, req.user.sub);

    return toNotaAjusteResponse(nota, 'Nota Débito creada en borrador. Use /emitir para enviar a DIAN.');
  }


  @Get('debito')
  @Permissions(Permission.INVOICE_READ)
  async listarNotasDebito(@Query() filtros: NotasAjusteFilterDto) {
    filtros.tipo = 'debito' as any;
    const result = await this.notasAjusteService.findAll(filtros);

    return {
      success: true,
      message: 'Notas Débito obtenidas',
      data: result.data,
      meta: result.meta
    };
  }

  // ========== OPERACIONES GENERALES ==========

  /**
   * Listar todas las notas de ajuste
   * 
   * GET /api/notas-ajuste
   * ?tipo=credito|debito
   * &estado=borrador|aceptada|rechazada
   * &facturaNumero=FE-00012345
   */
  @Get()
  @Permissions(Permission.INVOICE_READ)
  async findAll(@Query() filtros: NotasAjusteFilterDto) {
    const result = await this.notasAjusteService.findAll(filtros);

    return {
      success: true,
      message: 'Notas de ajuste obtenidas',
      data: result.data,
      meta: result.meta
    };
  }

  /**
   * Obtener nota de ajuste por ID
   */
  @Get(':id')
  @Permissions(Permission.INVOICE_READ)
  async findOne(@Param('id') id: string) {
    const nota = await this.notasAjusteService.findOne(id);
    return toNotaAjusteResponse(nota, 'Nota de ajuste obtenida');
  }

  /**
   * Emitir nota de ajuste (enviar a DIAN)
   * 
   * PATCH /api/notas-ajuste/:id/emitir
   * 
   * Proceso:
   * 1. Valida que esté en borrador
   * 2. Envía a DIAN vía Factus
   * 3. Procesa respuesta
   * 4. Actualiza estado
   * 5. Genera asiento contable
   */
  @Patch(':id/emitir')
  @Permissions(Permission.INVOICE_CREATE)
  @HttpCode(HttpStatus.OK)
  async emitir(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.emitir(id, req.user.sub);

    let mensaje: string;
    if (nota.estadoDIAN === 'aceptada') {
      mensaje = `✅ ${nota.tipo === 'credito' ? 'Nota Crédito' : 'Nota Débito'} aceptada por DIAN. CUFE: ${nota.cufe}`;
    } else if (nota.estadoDIAN === 'rechazada') {
      mensaje = `❌ ${nota.tipo === 'credito' ? 'Nota Crédito' : 'Nota Débito'} rechazada: ${nota.mensajeError}`;
    } else {
      mensaje = '⏳ Nota enviada a DIAN, esperando validación...';
    }

    return toNotaAjusteResponse(nota, mensaje);
  }

  /**
   * Sincronizar estado de la nota con DIAN
   */
  @Patch(':id/sincronizar')
  @Permissions(Permission.INVOICE_UPDATE)
  @HttpCode(HttpStatus.OK)
  async sincronizar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.sincronizarConDIAN(id, req.user.sub);
    return toNotaAjusteResponse(nota, 'Estado sincronizado con la DIAN exitosamente');
  }

  /**
   * Reintentar generación de asiento contable
   */
  @Patch(':id/reintentar-asiento')
  @Permissions(Permission.INVOICE_UPDATE)
  @HttpCode(HttpStatus.OK)
  async reintentarAsiento(@Param('id') id: string) {
    const nota = await this.notasAjusteService.reintentarAsiento(id);
    return toNotaAjusteResponse(nota, 'Asiento contable generado exitosamente');
  }


  /**
   * Actualizar borrador NC V2 (recalcula por concepto).
   *
   * PATCH /api/notas-ajuste/:id/v2
   */
  @Patch(':id/v2')
  @Permissions(Permission.INVOICE_UPDATE)
  async updateV2(@Param('id') id: string, @Body() updateDto: UpdateNotaCreditoV2Dto) {
    const nota = await this.notasAjusteService.updateNotaCreditoV2(id, updateDto);
    return toNotaAjusteResponse(nota, 'Nota crédito actualizada (recálculo por concepto)');
  }

  /**
   * Actualizar nota (solo borrador, formato legacy)
   */
  @Patch(':id')
  @Permissions(Permission.INVOICE_UPDATE)
  async update(@Param('id') id: string, @Body() updateDto: UpdateNotasAjusteDto) {
    const nota = await this.notasAjusteService.update(id, updateDto);
    return toNotaAjusteResponse(nota, 'Nota actualizada exitosamente');
  }

  /**
   * Anular nota de ajuste
   * 
   * PATCH /api/notas-ajuste/:id/anular
   * Body: { motivo: "Razón de anulación" }
   */
  @Patch(':id/anular')
  @Permissions(Permission.INVOICE_DELETE)
  @HttpCode(HttpStatus.OK)
  async anular(@Param('id') id: string, @Body() body: { motivo: string }) {
    const nota = await this.notasAjusteService.anular(id, body.motivo);
    return toNotaAjusteResponse(nota, 'Nota de ajuste anulada');
  }

  /**
   * Eliminar nota de ajuste (solo borrador)
   */
  @Delete(':id')
  @Permissions(Permission.INVOICE_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.notasAjusteService.remove(id);
    return toNotaAjusteResponse([], 'Nota de ajuste eliminada');
  }

  // ========== CONSULTAS ESPECIALES ==========

  /**
   * Obtener notas de una factura específica
   * 
   * GET /api/notas-ajuste/factura/:facturaId
   * 
   * Retorna todas las notas crédito y débito asociadas a una factura
   */
  @Get('factura/:facturaId')
  @Permissions(Permission.INVOICE_READ)
  async obtenerNotasPorFactura(@Param('facturaId') facturaId: string) {
    const notas = await this.notasAjusteService.obtenerNotasPorFactura(facturaId);
    const impacto = await this.notasAjusteService.calcularImpactoEnFactura(facturaId);

    return {
      success: true,
      message: 'Notas de la factura obtenidas',
      data: {
        notas,
        impacto: {
          notasCredito: impacto.totalNotasCredito,
          notasDebito: impacto.totalNotasDebito,
          saldoNeto: impacto.saldoNeto,
          descripcion: impacto.saldoNeto < 0
            ? `Saldo a favor del cliente: $${Math.abs(impacto.saldoNeto)}`
            : impacto.saldoNeto > 0
              ? `Saldo adicional a pagar: $${impacto.saldoNeto}`
              : 'Sin saldo pendiente'
        }
      }
    };
  }

  /**
   * Disponibilidad por concepto para una factura (guía NC 2026 §2).
   *
   * GET /api/notas-ajuste/disponibilidad/:facturaId
   *
   * Retorna por línea: cantidad disponible (devolución),
   * valor de descuento disponible, valor de ajuste disponible,
   * y estado del documento (anulada/bloqueada/saldo).
   */
  @Get('disponibilidad/:facturaId')
  @Permissions(Permission.INVOICE_READ)
  async calcularDisponibilidad(@Param('facturaId') facturaId: string) {
    const disponibilidad = await this.disponibilidadService.calcular(facturaId);

    return {
      success: true,
      message: 'Disponibilidad por concepto calculada',
      data: disponibilidad
    };
  }

  /**
   * Sonda de payment_details para sandbox (NO envía a Factus).
   *
   * GET /api/notas-ajuste/sonda-pago/:facturaId?total=100000&strategy=espejo-factura
   *
   * Devuelve la matriz de candidatas (espejo/contado-10/credito-30d)
   * para probar qué combinación acepta Factus por concepto antes de fijarla.
   */
  @Get('sonda-pago/:facturaId')
  @Permissions(Permission.INVOICE_READ)
  async sondaPaymentDetails(
    @Param('facturaId') facturaId: string,
    @Query('total') total?: string,
    @Query('strategy') strategy?: PaymentStrategyName,
  ) {
    const factura = await this.disponibilidadService.facturaFuente(facturaId);
    const totalNota = Number(total ?? (factura as any).total ?? 0);
    const efectiva = this.paymentResolver.resolve(factura, totalNota, strategy);
    const matriz = this.paymentResolver.candidates(factura, totalNota);

    return {
      success: true,
      message: 'Matriz de payment_details (sin envío a Factus)',
      data: {
        facturaId,
        facturaFormaPago: factura.formaPago,
        facturaMetodoPago: factura.metodoPago,
        facturaVencimiento: factura.fechaVencimiento,
        totalNota,
        efectiva,
        matriz,
      }
    };
  }

  /**
   * Calcular impacto de notas en una factura
   *
   * GET /api/notas-ajuste/impacto/:facturaId
   */
  @Get('impacto/:facturaId')
  @Permissions(Permission.INVOICE_READ)
  async calcularImpacto(@Param('facturaId') facturaId: string) {
    const impacto = await this.notasAjusteService.calcularImpactoEnFactura(facturaId);

    return {
      success: true,
      message: 'Impacto calculado',
      data: impacto
    };
  }

  // ========== DESCARGAS ==========

  /**
   * Descargar PDF de nota de ajuste
   */
  @Get(':id/pdf')
  @Permissions(Permission.INVOICE_READ)
  async descargarPDF(@Param('id') id: string, @Res() res: Response) {
    const nota = await this.notasAjusteService.findOne(id);

    if (!nota.pdfUrl) {
      throw new BadRequestException('Esta nota no tiene PDF generado');
    }

    const { buffer, fileName } = await this.notasAjusteService.descargarPDF(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${fileName}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * Descargar XML de nota de ajuste
   */
  @Get(':id/xml')
  @Permissions(Permission.INVOICE_READ)
  async descargarXML(@Param('id') id: string, @Res() res: Response) {
    const nota = await this.notasAjusteService.findOne(id);

    if (!nota.xmlUrl) {
      throw new BadRequestException('Esta nota no tiene XML generado');
    }

    const { buffer, fileName } = await this.notasAjusteService.descargarXML(id);

    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename=${fileName}.xml`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ========== ESTADÍSTICAS ==========

  /**
   * Estadísticas de notas de ajuste
   * 
   * GET /api/notas-ajuste/reportes/estadisticas
   * ?fechaInicio=2025-01-01&fechaFin=2025-01-31
   */
  @Get('reportes/estadisticas')
  @Permissions(Permission.REPORT_READ)
  async getEstadisticas(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string
  ) {
    const filtros: NotasAjusteFilterDto = {
      fechaInicio,
      fechaFin,
      limit: 1000
    };

    const result = await this.notasAjusteService.findAll(filtros);
    const notas = result.data;

    const notasCredito = notas.filter(n => n.tipo === 'credito');
    const notasDebito = notas.filter(n => n.tipo === 'debito');

    return {
      success: true,
      message: 'Estadísticas obtenidas',
      data: {
        resumen: {
          total: notas.length,
          notasCredito: notasCredito.length,
          notasDebito: notasDebito.length
        },
        credito: {
          total: notasCredito.length,
          aceptadas: notasCredito.filter(n => n.estado === 'aceptada').length,
          rechazadas: notasCredito.filter(n => n.estado === 'rechazada').length,
          montoTotal: notasCredito
            .filter(n => n.estado === 'aceptada')
            .reduce((sum, n) => sum + Number(n.total), 0)
        },
        debito: {
          total: notasDebito.length,
          aceptadas: notasDebito.filter(n => n.estado === 'aceptada').length,
          rechazadas: notasDebito.filter(n => n.estado === 'rechazada').length,
          montoTotal: notasDebito
            .filter(n => n.estado === 'aceptada')
            .reduce((sum, n) => sum + Number(n.total), 0)
        },
        impactoNeto: notasDebito
          .filter(n => n.estado === 'aceptada')
          .reduce((sum, n) => sum + Number(n.total), 0) -
          notasCredito
            .filter(n => n.estado === 'aceptada')
            .reduce((sum, n) => sum + Number(n.total), 0)
      }
    };
  }
}
