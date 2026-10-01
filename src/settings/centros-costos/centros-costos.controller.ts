import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto } from './dto/create-centro-costo.dto';
import { UpdateCentroCostoDto } from './dto/update-centro-costo.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';

@Controller('settings/centros-costos')
@UseGuards(AuthGuard, RolesGuard)
export class CentrosCostosController {
    constructor(private readonly centrosCostosService: CentrosCostosService) {}

    @Post()
    @Permissions(Permission.SETTINGS_UPDATE)
    create(@Body() createCentroCostoDto: CreateCentroCostoDto) {
        return this.centrosCostosService.create(createCentroCostoDto);
    }

    @Get()
    @Permissions(Permission.SETTINGS_UPDATE)
    findAll() {
        return this.centrosCostosService.findAll();
    }

    @Get(':id')
    @Permissions(Permission.SETTINGS_UPDATE)
    findOne(@Param('id') id: string) {
        return this.centrosCostosService.findOne(id);
    }

    @Patch(':id')
    @Permissions(Permission.SETTINGS_UPDATE)
    update(@Param('id') id: string, @Body() updateCentroCostoDto: UpdateCentroCostoDto) {
        return this.centrosCostosService.update(id, updateCentroCostoDto);
    }

    @Delete(':id')
    @Permissions(Permission.SETTINGS_UPDATE)
    remove(@Param('id') id: string) {
        return this.centrosCostosService.remove(id);
    }
}
