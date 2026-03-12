import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, Res } from '@nestjs/common';
import { FacturasVentasService } from './facturas-ventas.service';
import { CreateFacturasVentaDto } from './dto/create-facturas-venta.dto';
import { UpdateFacturasVentaDto } from './dto/update-facturas-venta.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { Permission } from 'src/common/constants/roles.constants';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { toInvoiceResponse } from './dto/invoice-response.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { Response } from 'express';

@Controller('facturas-ventas')
@UseGuards(AuthGuard, RolesGuard)
export class FacturasVentasController {
  constructor(private readonly facturasVentasService: FacturasVentasService) { }

  @Post()
  async create(@Body() createFacturasVentaDto: CreateFacturasVentaDto, @Req() req: AuthenticatedRequest) {
    const invoice = await this.facturasVentasService.create(createFacturasVentaDto, req.user.sub);
    return toInvoiceResponse(invoice, 'Factura creada exitosamente');
  }

  @Get()
  async findAll(@Query() pagination: InvoiceFilterDto) {
    const result = await this.facturasVentasService.findAll(pagination);
    return toInvoiceResponse(result.data, 'Facturas obtenidas exitosamente', result.meta);
  }

  @Get('estadisticas')
  async getEstadisticas() {
    const stats = await this.facturasVentasService.getEstadisticas();
    return toInvoiceResponse(stats, 'Estadísticas obtenidas exitosamente');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const invoice = await this.facturasVentasService.findOne(id);
    return toInvoiceResponse([invoice], 'Factura obtenida exitosamente');
  }

  @Patch(':id')
  @Permissions(Permission.INVOICE_UPDATE)
  async update(@Param('id') id: string, @Body() updateFacturasVentaDto: UpdateFacturasVentaDto) {
    const invoice = await this.facturasVentasService.update(id, updateFacturasVentaDto);
    return toInvoiceResponse(invoice, 'Factura actualizada exitosamente');
  }

  @Delete(':id')
  @Permissions(Permission.INVOICE_DELETE)
  async remove(@Param('id') id: string) {
    await this.facturasVentasService.remove(id);
    return toInvoiceResponse([], 'Factura eliminada exitosamente');
  }

  @Post(':id/emitir')
  async emitir(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const invoice = await this.facturasVentasService.emitir(id, req.user.sub);
    return toInvoiceResponse(invoice, 'Factura emitida exitosamente');
  }

  @Post(':id/reintentar')
  async reintentar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const invoice = await this.facturasVentasService.reintentarEnvio(id, req.user.sub);
    return toInvoiceResponse(invoice, 'Reintento de envío exitoso');
  }

  @Patch(':id/pago')
  async registrarPago(@Param('id') id: string, @Body('metodoPago') metodoPago: string, @Req() req: AuthenticatedRequest) {
    const invoice = await this.facturasVentasService.registrarPago(id, metodoPago, req.user.sub);
    return toInvoiceResponse(invoice, 'Pago registrado exitosamente');
  }

  @Post(':id/anular')
  async anular(@Param('id') id: string, @Body('motivo') motivo: string, @Req() req: AuthenticatedRequest) {
    const invoice = await this.facturasVentasService.anular(id, motivo, req.user.sub);
    return toInvoiceResponse(invoice, 'Factura anulada exitosamente');
  }

  @Get(':id/pdf')
  async descargarPDF(@Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.facturasVentasService.descargarPDF(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${fileName}.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/xml')
  async descargarXML(@Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.facturasVentasService.descargarXML(id);
    res.set({
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename=${fileName}.xml`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
