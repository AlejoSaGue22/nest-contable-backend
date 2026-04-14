import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';

@Controller('proveedores')
@UseGuards(AuthGuard, RolesGuard)
export class ProveedoresController {
    constructor(private readonly proveedoresService: ProveedoresService) { }

    @Post()
    @Permissions(Permission.PROVIDER_CREATE)
    create(@Body() createProveedorDto: CreateProveedorDto) {
        return this.proveedoresService.create(createProveedorDto);
    }

    @Get()
    @Permissions(Permission.PROVIDER_READ)
    findAll(@Query() pagination: PaginatioDto) {
        return this.proveedoresService.findAll(pagination);
    }

    @Get(':id')
    @Permissions(Permission.PROVIDER_READ)
    findOne(@Param('id') id: string) {
        return this.proveedoresService.findOne(id);
    }

    @Patch(':id')
    @Permissions(Permission.PROVIDER_UPDATE)
    update(@Param('id') id: string, @Body() updateProveedorDto: UpdateProveedorDto) {
        return this.proveedoresService.update(id, updateProveedorDto);
    }

    @Delete(':id')
    @Permissions(Permission.PROVIDER_DELETE)
    remove(@Param('id') id: string) {
        return this.proveedoresService.remove(id);
    }
}
