import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CargosService } from './cargos.service';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';

@Controller('settings/cargos')
@UseGuards(AuthGuard, RolesGuard)
export class CargosController {
    constructor(private readonly cargosService: CargosService) {}

    @Post()
    @Permissions(Permission.SETTINGS_UPDATE)
    create(@Body() createCargoDto: CreateCargoDto) {
        return this.cargosService.create(createCargoDto);
    }

    @Get()
    @Permissions(Permission.SETTINGS_UPDATE)
    findAll() {
        return this.cargosService.findAll();
    }

    @Get(':id')
    @Permissions(Permission.SETTINGS_UPDATE)
    findOne(@Param('id') id: string) {
        return this.cargosService.findOne(id);
    }

    @Patch(':id')
    @Permissions(Permission.SETTINGS_UPDATE)
    update(@Param('id') id: string, @Body() updateCargoDto: UpdateCargoDto) {
        return this.cargosService.update(id, updateCargoDto);
    }

    @Delete(':id')
    @Permissions(Permission.SETTINGS_UPDATE)
    remove(@Param('id') id: string) {
        return this.cargosService.remove(id);
    }
}
