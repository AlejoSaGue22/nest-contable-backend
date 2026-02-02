import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, UseGuards } from '@nestjs/common';
import { FacturasComprasService } from './facturas-compras.service';
import { CreateFacturaCompraDto } from './dto/create-factura-compra.dto';
import { UpdateFacturaCompraDto } from './dto/update-factura-compra.dto';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';

@Controller('facturas-compras')
@UseGuards(AuthGuard)
export class FacturasComprasController {
    constructor(private readonly facturasComprasService: FacturasComprasService) { }

    @Post()
    @Permissions(Permission.INVOICE_CREATE)
    async create(@Body() createFacturaCompraDto: CreateFacturaCompraDto, @Req() req: AuthenticatedRequest) {
        return await this.facturasComprasService.create(createFacturaCompraDto, req.user.email);
    }

    @Get()
    @Permissions(Permission.INVOICE_READ)
    async findAll(@Query('page') page: number, @Query('limit') limit: number) {
        return await this.facturasComprasService.findAll(page, limit);
    }

    @Get(':id')
    @Permissions(Permission.INVOICE_READ)
    async findOne(@Param('id') id: string) {
        return await this.facturasComprasService.findOne(id);
    }

    @Patch(':id/anular')
    @Permissions(Permission.INVOICE_DELETE)
    async anular(@Param('id') id: string) {
        return await this.facturasComprasService.anular(id);
    }
}
