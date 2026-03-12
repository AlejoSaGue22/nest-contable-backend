import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe, Request } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { UpdatePagoDto } from './dto/update-pago.dto';
import { PaymentStatus } from './entities/pago.entity';
import { CxcService } from 'src/common/services/cxc.service';
import { CxpService } from 'src/common/services/cxp.service';
import { RegistrarCobroDto, RegistrarPagoDto } from './dto/create-pago.dto';

// Sustituye por tu guard real de autenticación
// import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

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
  ) {
    return this.cxcService.findAll({
      clienteId,
      paymentStatus,
      soloVencidas: soloVencidas === 'true',
    });
  }

  /**
   * GET /cxc/aging
   * Reporte de antigüedad de cartera (aging) por cliente.
   */
  @Get('cxc/aging')
  async agingCxC() {
    return this.cxcService.aging();
  }

  /**
   * GET /cxc/cliente/:clienteId
   * Estado de cuenta completo de un cliente: deuda total + aging + facturas.
   */
  @Get('cxc/cliente/:clienteId')
  async estadoCuentaCliente(@Param('clienteId') clienteId: string) {
    return this.cxcService.estadoCuentaCliente(clienteId);
  }

  /**
   * GET /cxc/:facturaVentaId/historial
   * Historial de todos los cobros registrados sobre una factura de venta.
   */
  @Get('cxc/:facturaVentaId/historial')
  async historialCobros(
    @Param('facturaVentaId', ParseUUIDPipe) facturaVentaId: string,
  ) {
    return this.pagosService.historialCobros(facturaVentaId);
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
    @Request() req: any,
  ) {
    // req.user.id → del JWT guard
    const userId = req.user?.id ?? 'system';
    return this.pagosService.registrarCobro(facturaVentaId, dto, userId);
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
  ) {
    return this.cxpService.findAll({
      proveedorId,
      paymentStatus,
      soloVencidas: soloVencidas === 'true',
    });
  }

  /**
   * GET /cxp/aging
   * Reporte de antigüedad de deuda (aging) por proveedor.
   */
  @Get('cxp/aging')
  async agingCxP() {
    return this.cxpService.aging();
  }

  /**
   * GET /cxp/proveedor/:proveedorId
   * Estado de cuenta completo de un proveedor: deuda total + aging + facturas.
   */
  @Get('cxp/proveedor/:proveedorId')
  async estadoCuentaProveedor(@Param('proveedorId') proveedorId: string) {
    return this.cxpService.estadoCuentaProveedor(proveedorId);
  }

  /**
   * GET /cxp/:facturaCompraId/historial
   * Historial de todos los pagos registrados sobre una factura de compra.
   */
  @Get('cxp/:facturaCompraId/historial')
  async historialPagos(
    @Param('facturaCompraId', ParseUUIDPipe) facturaCompraId: string,
  ) {
    return this.pagosService.historialPagos(facturaCompraId);
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
    @Request() req: any,
  ) {
    const userId = req.user?.id ?? 'system';
    return this.pagosService.registrarPago(facturaCompraId, dto, userId);
  }

  // ════════════════════════════════════════════════════════════
  // CUENTAS BANCARIAS
  // ════════════════════════════════════════════════════════════

  /**
   * GET /cuentas-bancarias
   * Lista las cuentas bancarias activas (para el select del modal de pago).
   */
  @Get('cuentas-bancarias')
  async listarCuentasBancarias() {
    return this.pagosService.findCuentasBancarias();
  }
}
