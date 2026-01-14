import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { FacturasVentasService } from './facturas-ventas.service';
import { CreateFacturasVentaDto } from './dto/create-facturas-venta.dto';
import { UpdateFacturasVentaDto } from './dto/update-facturas-venta.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { AuthenticatedRequest, RequestWithUser } from 'src/auth/interfaces/jwt-payload.interface';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { Permission } from 'src/common/constants/roles.constants';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { toInvoiceResponse } from './dto/invoice-response.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';



@Controller('facturas-ventas')
@UseGuards(AuthGuard, RolesGuard)
export class FacturasVentasController {
  constructor(private readonly facturasVentasService: FacturasVentasService) {}

  @Post()
  // @Permissions(Permission.INVOICE_CREATE)
  async create(@Body() createFacturasVentaDto: CreateFacturasVentaDto, @Req() req: AuthenticatedRequest) {
    const invoice = await this.facturasVentasService.create(createFacturasVentaDto, req.user.sub);
    return toInvoiceResponse(invoice, 'Factura creada exitosamente'); 
  }

  @Get()
  // @Permissions(Permission.INVOICE_READ)
  async findAll(@Query() pagination: InvoiceFilterDto) {
    const result = await this.facturasVentasService.findAll(pagination);
    return toInvoiceResponse(result.data, 'Facturas obtenidas exitosamente', result.meta);
  }

  @Get(':id')
  // @Permissions(Permission.INVOICE_READ)
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

  
}
