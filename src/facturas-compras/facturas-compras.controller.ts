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
    async findAll(@Query() pagination: InvoiceFilterDto) {
        const result = await this.facturasComprasService.findAll(pagination);
        return toInvoiceResponse(result.data, 'Facturas de compra obtenidas exitosamente', result.meta);
    }

    @Get(':id')
    @Permissions(Permission.INVOICE_READ)
    async findOne(@Param('id') id: string) {
        const invoice = await this.facturasComprasService.findOne(id);
        return toInvoiceResponse([invoice], 'Factura de compra obtenida exitosamente');
    }

    @Patch(':id/anular')
    @Permissions(Permission.INVOICE_DELETE)
    async anular(@Param('id') id: string) {
        const invoice = await this.facturasComprasService.anular(id);
        return toInvoiceResponse(invoice, 'Factura de compra anulada exitosamente');
    }
}
