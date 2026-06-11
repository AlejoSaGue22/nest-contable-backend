import { BadRequestException, Controller, Get, Post, Body, Param, Query, ParseUUIDPipe, Request, UseGuards } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { MedioPago, PaymentStatus, TipoPago } from './enums/pago.enum';
import { CxcService } from 'src/common/services/cxc.service';
import { CxpService } from 'src/common/services/cxp.service';
import { RegistrarCobroDto, RegistrarPagoDto } from './dto/create-pago.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { PagoResponseDto, toPagoResponse } from './dto/pago-response.dto';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';

/**
 * ══════════════════════════════════════════════════════════════
 * ENDPOINTS DE PAGOS / COBROS
 *
 * CxC (Cuentas por Cobrar — ventas a crédito):
 *   GET  /cxc                          → Lista CxC activas
 *   GET  /cxc/resumen                  → Totales por estado
 *   GET  /cxc/aging                    → Reporte antigüedad de cartera
 *   GET  /cxc/cliente/:clienteId       → Estado de cuenta del cliente
 *   GET  /cxc/:facturaVentaId/historial → Historial cobros de una factura
 *   POST /cxc/:facturaVentaId/cobro    → Registrar cobro/abono
 *
 * CxP (Cuentas por Pagar — compras a crédito):
 *   GET  /cxp                           → Lista CxP activas
 *   GET  /cxp/resumen                   → Totales por estado
 *   GET  /cxp/aging                     → Reporte antigüedad de deuda
 *   GET  /cxp/proveedor/:proveedorId    → Estado de cuenta del proveedor
 *   GET  /cxp/:facturaCompraId/historial → Historial pagos de una compra
 *   POST /cxp/:facturaCompraId/pago     → Registrar pago a proveedor
 *
 * General:
 *   GET  /cuentas-bancarias             → Lista cuentas bancarias activas
 * ══════════════════════════════════════════════════════════════
 */

@Controller('pagos')
@UseGuards(AuthGuard, RolesGuard)
export class PagosController {
  constructor(
    private readonly pagosService: PagosService,
    private readonly cxcService:   CxcService,
    private readonly cxpService:   CxpService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // CxC — CUENTAS POR COBRAR
  // ════════════════════════════════════════════════════════════

  /**
   * GET /cxc
   * Lista todas las cuentas por cobrar con saldo pendiente.
   * Query params:
   *   - clienteId?:     filtrar por cliente
   *   - paymentStatus?: pending | partial | overdue
   *   - soloVencidas?:  true | false
   */
  @Get('cxc')
  async listarCxC(
    @Query('clienteId')     clienteId?: string,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('soloVencidas')  soloVencidas?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<PagoResponseDto<any>> {
    const data = await this.cxcService.findAll({
      clienteId,
      paymentStatus,
      soloVencidas: soloVencidas === 'true',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 1
    });
    return toPagoResponse(data, 'Cuentas por cobrar obtenidas exitosamente');
  }

  /**
   * GET /cxc/aging
   * Reporte de antigüedad de cartera (aging) por cliente.
   */
  @Get('cxc/aging')
  async agingCxC(): Promise<PagoResponseDto<any>> {
    const data = await this.cxcService.aging();
    return toPagoResponse(data, 'Reporte de antigüedad de cartera generado');
  }

  /**
   * GET /cxc/cliente/:clienteId
   * Estado de cuenta completo de un cliente: deuda total + aging + facturas.
   */
  @Get('cxc/cliente/:clienteId')
  async estadoCuentaCliente(
    @Param('clienteId') clienteId: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.cxcService.estadoCuentaCliente(clienteId);
    return toPagoResponse(data, 'Estado de cuenta del cliente obtenido');
  }

  /**
   * GET /cxc/:facturaVentaId/historial
   * Historial de todos los cobros registrados sobre una factura de venta.
   */
  @Get('cxc/:facturaVentaId/historial')
  async historialCobros(
    @Param('facturaVentaId', ParseUUIDPipe) facturaVentaId: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.historialCobros(facturaVentaId);
    return toPagoResponse(data, 'Historial de cobros obtenido');
  }

  /**
   * POST /cxc/:facturaVentaId/cobro
   * Registra un abono (cobro) sobre una factura de venta a crédito.
   *
   * Body: RegistrarCobroDto
   *   { monto, fecha, medioPago, cuentaBancariaId?, referencia?, notas? }
   *
   * Genera asiento:
   *   DÉBITO:  Caja 1105 / Bancos 1110   <monto>
   *   CRÉDITO: Clientes 1305             <monto>
   */
  @Post('cxc/:facturaVentaId/cobro')
  async registrarCobro(
    @Param('facturaVentaId', ParseUUIDPipe) facturaVentaId: string,
    @Body() dto: RegistrarCobroDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PagoResponseDto<any>> {
    const userId = req.user.sub;
    const data = await this.pagosService.registrarCobro(facturaVentaId, dto, userId);
    return toPagoResponse(data, 'Cobro registrado exitosamente');
  }

  // ════════════════════════════════════════════════════════════
  // CxP — CUENTAS POR PAGAR
  // ════════════════════════════════════════════════════════════

  /**
   * GET /cxp
   * Lista todas las cuentas por pagar con saldo pendiente.
   * Query params:
   *   - proveedorId?:   filtrar por proveedor
   *   - paymentStatus?: pending | partial | overdue
   *   - soloVencidas?:  true | false
   */
  @Get('cxp')
  async listarCxP(
    @Query('proveedorId')   proveedorId?: string,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('soloVencidas')  soloVencidas?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.cxpService.findAll({
      proveedorId,
      paymentStatus,
      soloVencidas: soloVencidas === 'true',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
    return toPagoResponse(data, 'Cuentas por pagar obtenidas exitosamente');
  }

  /**
   * GET /cxp/aging
   * Reporte de antigüedad de deuda (aging) por proveedor.
   */
  @Get('cxp/aging')
  async agingCxP(): Promise<PagoResponseDto<any>> {
    const data = await this.cxpService.aging();
    return toPagoResponse(data, 'Reporte de antigüedad de deuda generado');
  }

  /**
   * GET /cxp/proveedor/:proveedorId
   * Estado de cuenta completo de un proveedor: deuda total + aging + facturas.
   */
  @Get('cxp/proveedor/:proveedorId')
  async estadoCuentaProveedor(
    @Param('proveedorId') proveedorId: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.cxpService.estadoCuentaProveedor(proveedorId);
    return toPagoResponse(data, 'Estado de cuenta del proveedor obtenido');
  }

  /**
   * GET /cxp/:facturaCompraId/historial
   * Historial de todos los pagos registrados sobre una factura de compra.
   */
  @Get('cxp/:facturaCompraId/historial')
  async historialPagos(
    @Param('facturaCompraId', ParseUUIDPipe) facturaCompraId: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.historialPagos(facturaCompraId);
    return toPagoResponse(data, 'Historial de pagos obtenido');
  }

  /**
   * POST /cxp/:facturaCompraId/pago
   * Registra un pago sobre una factura de compra a crédito.
   *
   * Body: RegistrarPagoDto
   *   { monto, fecha, medioPago, cuentaBancariaId?, referencia?, notas? }
   *
   * Genera asiento:
   *   DÉBITO:  Proveedores 2205         <monto>
   *   CRÉDITO: Caja 1105 / Bancos 1110  <monto>
   */
  @Post('cxp/:facturaCompraId/pago')
  async registrarPago(
    @Param('facturaCompraId', ParseUUIDPipe) facturaCompraId: string,
    @Body() dto: RegistrarPagoDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<PagoResponseDto<any>> {
    const userId = req.user?.sub;
    const data = await this.pagosService.registrarPago(facturaCompraId, dto, userId);
    return toPagoResponse(data, 'Pago registrado exitosamente');
  }

  // ════════════════════════════════════════════════════════════
  // RESUMEN FINANCIERO (Dashboard unificado)
  // ════════════════════════════════════════════════════════════

  @Get('resumen')
  async obtenerResumenFinanciero(): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.obtenerResumenFinanciero();
    return toPagoResponse(data, 'Resumen financiero obtenido exitosamente');
  }

  // ════════════════════════════════════════════════════════════
  // ESTADO DE CUENTA POR TERCERO
  // ════════════════════════════════════════════════════════════

  @Get('estado-cuenta/cliente/:clienteId')
  async obtenerEstadoCuentaCliente(
    @Param('clienteId', ParseUUIDPipe) clienteId: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.obtenerEstadoCuentaCliente(clienteId);
    return toPagoResponse(data, 'Estado de cuenta del cliente obtenido exitosamente');
  }

  @Get('estado-cuenta/cliente-por-documento')
  async obtenerEstadoCuentaClientePorDocumento(
    @Query('documento') documento: string,
  ): Promise<PagoResponseDto<any>> {
    if (!documento?.trim()) {
      throw new BadRequestException('El número de documento es requerido');
    }
    const data = await this.pagosService.obtenerEstadoCuentaClientePorDocumento(documento.trim());
    return toPagoResponse(data, 'Estado de cuenta del cliente obtenido exitosamente');
  }

  @Get('estado-cuenta/proveedor/:proveedorId')
  async obtenerEstadoCuentaProveedor(
    @Param('proveedorId', ParseUUIDPipe) proveedorId: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.obtenerEstadoCuentaProveedor(proveedorId);
    return toPagoResponse(data, 'Estado de cuenta del proveedor obtenido exitosamente');
  }

  @Get('estado-cuenta/proveedor-por-documento')
  async obtenerEstadoCuentaProveedorPorDocumento(
    @Query('documento') documento: string,
  ): Promise<PagoResponseDto<any>> {
    if (!documento?.trim()) {
      throw new BadRequestException('El número de documento es requerido');
    }
    const data = await this.pagosService.obtenerEstadoCuentaProveedorPorDocumento(documento.trim());
    return toPagoResponse(data, 'Estado de cuenta del proveedor obtenido exitosamente');
  }

  // ════════════════════════════════════════════════════════════
  // MOVIMIENTOS — LISTADO GLOBAL DE COBROS Y PAGOS
  // ════════════════════════════════════════════════════════════

  @Get('movimientos')
  async listarMovimientos(
    @Query('tipo') tipo?: TipoPago,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('medioPago') medioPago?: MedioPago,
    @Query('clienteId') clienteId?: string,
    @Query('proveedorId') proveedorId?: string,
    @Query('busqueda') busqueda?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.listarMovimientos({
      tipo,
      fechaInicio,
      fechaFin,
      medioPago,
      clienteId,
      proveedorId,
      busqueda,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    return toPagoResponse(data, 'Movimientos obtenidos exitosamente', data.meta);
  }

  // ════════════════════════════════════════════════════════════
  // ASIENTO CONTABLE DE UN PAGO
  // ════════════════════════════════════════════════════════════

  @Get(':id/asiento')
  async obtenerAsientoDePago(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.obtenerAsientoDePago(id);
    return toPagoResponse(data, 'Asiento contable obtenido exitosamente');
  }

  // ════════════════════════════════════════════════════════════
  // CUENTAS BANCARIAS
  // ════════════════════════════════════════════════════════════

  /**
   * GET /cuentas-bancarias
   * Lista las cuentas bancarias activas (para el select del modal de pago).
   */
  @Get('cuentas-bancarias')
  async listarCuentasBancarias(): Promise<PagoResponseDto<any>> {
    const data = await this.pagosService.findCuentasBancarias();
    return toPagoResponse(data, 'Cuentas bancarias obtenidas exitosamente');
  }
}
