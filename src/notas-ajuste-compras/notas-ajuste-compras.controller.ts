import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CreateNotasAjusteCompraDto } from './dto/create-notas-ajuste-compra.dto';
import { UpdateNotasAjusteCompraDto } from './dto/update-notas-ajuste-compra.dto';
import { NotasAjusteCompraFilterDto, toNotaAjusteCompraResponse } from './dto/nota-ajuste-compra-filter.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { NotasAjusteComprasService } from './notas-ajuste-compras.service';

@Controller('notas-ajuste-compras')
@UseGuards(AuthGuard, RolesGuard)
export class NotasAjusteComprasController {
  constructor(private readonly notasAjusteService: NotasAjusteComprasService) { }

  @Post('credito')
  @Permissions(Permission.PURCHASE_CREATE)
  async crearNotaCredito(@Body() createDto: CreateNotasAjusteCompraDto, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.crearNotaCredito(createDto, req.user.sub);
    return toNotaAjusteCompraResponse(nota, 'Nota Crédito de Compra creada en borrador.');
  }

  @Post('debito')
  @Permissions(Permission.PURCHASE_CREATE)
  async crearNotaDebito(@Body() createDto: CreateNotasAjusteCompraDto, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.crearNotaDebito(createDto, req.user.sub);
    return toNotaAjusteCompraResponse(nota, 'Nota Débito de Compra creada en borrador.');
  }

  @Get()
  @Permissions(Permission.PURCHASE_READ)
  async findAll(@Query() filtros: NotasAjusteCompraFilterDto) {
    const result = await this.notasAjusteService.findAll(filtros);
    return {
      success: true,
      message: 'Notas de ajuste de compra obtenidas',
      data: result.data,
      meta: result.meta
    };
  }

  @Get(':id')
  @Permissions(Permission.PURCHASE_READ)
  async findOne(@Param('id') id: string) {
    const nota = await this.notasAjusteService.findOne(id);
    return toNotaAjusteCompraResponse(nota, 'Nota de ajuste de compra obtenida');
  }

  @Patch(':id/registrar')
  @Permissions(Permission.PURCHASE_UPDATE)
  @HttpCode(HttpStatus.OK)
  async registrar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.registrar(id, req.user.sub);
    return toNotaAjusteCompraResponse(nota, 'Nota de ajuste registrada exitosamente.');
  }

  @Patch(':id')
  @Permissions(Permission.PURCHASE_UPDATE)
  async update(@Param('id') id: string, @Body() updateDto: UpdateNotasAjusteCompraDto) {
    const nota = await this.notasAjusteService.update(id, updateDto);
    return toNotaAjusteCompraResponse(nota, 'Nota de ajuste actualizada exitosamente.');
  }

  @Delete(':id')
  @Permissions(Permission.PURCHASE_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.notasAjusteService.remove(id);
    return toNotaAjusteCompraResponse([], 'Nota de ajuste eliminada.');
  }

  @Patch(':id/reintentar-asiento')
  @Permissions(Permission.PURCHASE_UPDATE)
  @HttpCode(HttpStatus.OK)
  async reintentarAsiento(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.reintentarAsiento(id, req.user.sub);
    return toNotaAjusteCompraResponse(nota, 'Asiento contable generado exitosamente.');
  }

  @Patch(':id/anular')
  @Permissions(Permission.PURCHASE_DELETE)
  @HttpCode(HttpStatus.OK)
  async anular(@Param('id') id: string, @Body() body: { motivo: string }) {
    const nota = await this.notasAjusteService.anular(id, body.motivo);
    return toNotaAjusteCompraResponse(nota, 'Nota de ajuste anulada.');
  }
}
