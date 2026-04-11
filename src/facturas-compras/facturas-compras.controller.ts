import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, UseGuards } from '@nestjs/common';
import { FacturasComprasService } from './facturas-compras.service';
import { CreateFacturaCompraDto } from './dto/create-factura-compra.dto';
import { UpdateFacturaCompraDto } from './dto/update-factura-compra.dto';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { toInvoiceResponse } from 'src/facturas-ventas/dto/invoice-response.dto';
import { InvoiceFilterDto } from 'src/facturas-ventas/dto/invoice-filter.dto';
import { ComprasFilterDto } from './dto/compras-filter.dto';

@Controller('facturas-compras')
@UseGuards(AuthGuard)
export class FacturasComprasController {
    constructor(private readonly facturasComprasService: FacturasComprasService) { }

    @Post()
    @Permissions(Permission.INVOICE_CREATE)
    async create(@Body() createFacturaCompraDto: CreateFacturaCompraDto, @Req() req: AuthenticatedRequest) {
        const invoice = await this.facturasComprasService.create(createFacturaCompraDto, req.user.sub);
        return toInvoiceResponse(invoice, 'Factura de compra creada exitosamente');
    }

    @Get()
    @Permissions(Permission.INVOICE_READ)
    async findAll(@Query() pagination: ComprasFilterDto) {
        const result = await this.facturasComprasService.findAll(pagination);
        return toInvoiceResponse(result.data, 'Facturas de compra obtenidas exitosamente', result.meta);
    }

    @Get(':id')
    @Permissions(Permission.INVOICE_READ)
    async findOne(@Param('id') id: string) {
        const invoice = await this.facturasComprasService.findOne(id);
        return toInvoiceResponse([invoice], 'Factura de compra obtenida exitosamente');
    }

    @Patch(':id')
    @Permissions(Permission.INVOICE_UPDATE)
    async update(@Param('id') id: string, @Body() updateFacturasCompraDto: UpdateFacturaCompraDto) {
        const invoice = await this.facturasComprasService.update(id, updateFacturasCompraDto);
        return toInvoiceResponse(invoice, 'Factura actualizada exitosamente');
    }

    @Patch(':id/registrar')
    @Permissions(Permission.INVOICE_UPDATE)
    async registrar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        const invoice = await this.facturasComprasService.registrar(id, req.user.sub);
        return toInvoiceResponse(invoice, 'Factura de compra registrada exitosamente');
    }

    @Patch(':id/anular')
    @Permissions(Permission.INVOICE_DELETE)
    async anular(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        const invoice = await this.facturasComprasService.anular(id, req.user.sub);
        return toInvoiceResponse(invoice, 'Factura de compra anulada exitosamente');
    }

    @Delete(':id')
    @Permissions(Permission.INVOICE_DELETE)
    async remove(@Param('id') id: string) {
        await this.facturasComprasService.remove(id);
        return toInvoiceResponse([], 'Factura eliminada exitosamente');
    }
}
