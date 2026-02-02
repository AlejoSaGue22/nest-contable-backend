import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

@Controller('proveedores')
export class ProveedoresController {
    constructor(private readonly proveedoresService: ProveedoresService) { }

    @Post()
    create(@Body() createProveedorDto: CreateProveedorDto) {
        return this.proveedoresService.create(createProveedorDto);
    }

    @Get()
    findAll(@Query() pagination: PaginatioDto) {
        return this.proveedoresService.findAll(pagination);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.proveedoresService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateProveedorDto: UpdateProveedorDto) {
        return this.proveedoresService.update(id, updateProveedorDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.proveedoresService.remove(id);
    }
}
