import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';

@Controller('clientes')
@UseGuards(AuthGuard, RolesGuard)
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) { }

    @Post()
    @Permissions(Permission.CLIENT_CREATE)
    create(@Body() createClienteDto: CreateClienteDto) {
        return this.clientesService.create(createClienteDto);
    }

    @Get()
    @Permissions(Permission.CLIENT_READ)
    findAll(@Query() pagination: PaginatioDto) {
        return this.clientesService.findAll(pagination);
    }

    @Get(':id')
    @Permissions(Permission.CLIENT_READ)
    findOne(@Param('id') id: string) {
        return this.clientesService.findOne(id);
    }

    @Patch(':id')
    @Permissions(Permission.CLIENT_UPDATE)
    update(@Param('id') id: string, @Body() updateClienteDto: UpdateClienteDto) {
        return this.clientesService.update(id, updateClienteDto);
    }

    @Delete('delete/:id')
    @Permissions(Permission.CLIENT_DELETE)
    remove(@Param('id') id: string) {
        return this.clientesService.remove(id);
    }
}
