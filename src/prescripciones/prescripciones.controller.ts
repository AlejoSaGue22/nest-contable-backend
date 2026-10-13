import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { CreatePrescripcionDto } from './dto/create-prescripcion.dto';
import { PrescripcionFilterDto } from './dto/prescripcion-filter.dto';
import { UpdatePrescripcionDto } from './dto/update-prescripcion.dto';
import { PrescripcionesService } from './prescripciones.service';

@Controller('prescripciones')
@UseGuards(AuthGuard, RolesGuard)
export class PrescripcionesController {
  constructor(private readonly service: PrescripcionesService) { }

  @Get() @Permissions(Permission.INVOICE_READ)
  async findAll(@Query() filter: PrescripcionFilterDto) {
    return { success: true, ...(await this.service.findAll(filter)) };
  }

  @Get('history/:clienteId') @Permissions(Permission.INVOICE_READ)
  async history(@Param('clienteId', ParseUUIDPipe) clienteId: string) {
    return { success: true, data: await this.service.history(clienteId) };
  }

  @Get(':id') @Permissions(Permission.INVOICE_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.service.findOne(id) };
  }

  @Post() @Permissions(Permission.INVOICE_CREATE)
  async create(@Body() dto: CreatePrescripcionDto, @CurrentUser() user: User) {
    return { success: true, data: await this.service.create(dto, user.id) };
  }

  @Patch(':id') @Permissions(Permission.INVOICE_UPDATE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePrescripcionDto) {
    return { success: true, data: await this.service.update(id, dto) };
  }

  @Delete(':id') @Permissions(Permission.INVOICE_DELETE)
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.service.cancel(id) };
  }
}
