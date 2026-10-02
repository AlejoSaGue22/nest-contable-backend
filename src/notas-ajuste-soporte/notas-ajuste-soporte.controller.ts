import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, UseGuards, HttpCode, HttpStatus, Res, StreamableFile } from '@nestjs/common';
import { CreateNotaAjusteSoporteDto } from './dto/create-nota-ajuste-soporte.dto';
import { UpdateNotaAjusteSoporteDto } from './dto/update-nota-ajuste-soporte.dto';
import { NotaAjusteSoporteFilterDto } from './dto/nota-ajuste-soporte-filter.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { NotasAjusteSoporteService } from './notas-ajuste-soporte.service';
import type { Response } from 'express';

function toResponse(nota: any, mensaje?: string) {
  return { success: true, message: mensaje || 'Operación exitosa', data: nota };
}

@Controller('notas-ajuste-soporte')
@UseGuards(AuthGuard, RolesGuard)
export class NotasAjusteSoporteController {
  constructor(private readonly notasAjusteService: NotasAjusteSoporteService) { }

  @Post('credito')
  @Permissions(Permission.PURCHASE_CREATE)
  async crearNotaCredito(@Body() createDto: CreateNotaAjusteSoporteDto, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.crearNotaCredito(createDto, req.user.sub);
    return toResponse(nota, 'Nota Crédito a documento soporte creada.');
  }

  @Post('debito')
  @Permissions(Permission.PURCHASE_CREATE)
  async crearNotaDebito(@Body() createDto: CreateNotaAjusteSoporteDto, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.crearNotaDebito(createDto, req.user.sub);
    return toResponse(nota, 'Nota Débito a documento soporte creada.');
  }

  @Get()
  @Permissions(Permission.PURCHASE_READ)
  async findAll(@Query() filtros: NotaAjusteSoporteFilterDto) {
    const result = await this.notasAjusteService.findAll(filtros);
    return {
      success: true,
      message: 'Notas de ajuste a soporte obtenidas',
      data: result.data,
      meta: result.meta
    };
  }

  @Get(':id/pdf')
  @Permissions(Permission.PURCHASE_READ)
  async descargarPdf(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { buffer, fileName } = await this.notasAjusteService.descargarPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @Permissions(Permission.PURCHASE_READ)
  async findOne(@Param('id') id: string) {
    const nota = await this.notasAjusteService.findOne(id);
    return toResponse(nota, 'Nota de ajuste a soporte obtenida');
  }

  @Patch(':id/registrar')
  @Permissions(Permission.PURCHASE_UPDATE)
  @HttpCode(HttpStatus.OK)
  async registrar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.registrar(id, req.user.sub);
    return toResponse(nota, 'Nota de ajuste a soporte registrada exitosamente.');
  }

  @Patch(':id')
  @Permissions(Permission.PURCHASE_UPDATE)
  async update(@Param('id') id: string, @Body() updateDto: UpdateNotaAjusteSoporteDto) {
    const nota = await this.notasAjusteService.update(id, updateDto);
    return toResponse(nota, 'Nota de ajuste a soporte actualizada exitosamente.');
  }

  @Delete(':id')
  @Permissions(Permission.PURCHASE_DELETE)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.notasAjusteService.remove(id);
    return toResponse([], 'Nota de ajuste a soporte eliminada.');
  }

  @Patch(':id/reintentar-asiento')
  @Permissions(Permission.PURCHASE_UPDATE)
  @HttpCode(HttpStatus.OK)
  async reintentarAsiento(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const nota = await this.notasAjusteService.reintentarAsiento(id, req.user.sub);
    return toResponse(nota, 'Asiento contable generado exitosamente.');
  }

  @Patch(':id/anular')
  @Permissions(Permission.PURCHASE_DELETE)
  @HttpCode(HttpStatus.OK)
  async anular(@Param('id') id: string, @Body() body: { motivo: string }) {
    const nota = await this.notasAjusteService.anular(id, body.motivo);
    return toResponse(nota, 'Nota de ajuste a soporte anulada.');
  }
}
