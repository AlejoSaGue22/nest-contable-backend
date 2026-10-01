import { Controller, Get, Post, Body, Patch, Param, Delete, Req, Query, UseGuards, Res, StreamableFile } from '@nestjs/common';
import { DocumentosSoportesService } from './documentos-soportes.service';
import { CreateDocumentoSoporteDto } from './dto/create-documento-soporte.dto';
import { UpdateDocumentoSoporteDto } from './dto/update-documento-soporte.dto';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { DocumentoSoporteFilterDto } from './dto/documento-soporte-filter.dto';
import type { Response } from 'express';

function toDocumentoResponse(data: any, message: string, meta?: any) {
    return { success: true, message, data, meta };
}

@Controller('documentos-soportes')
@UseGuards(AuthGuard)
export class DocumentosSoportesController {
    constructor(private readonly documentosSoportesService: DocumentosSoportesService) { }

    @Post()
    @Permissions(Permission.PURCHASE_CREATE)
    async create(@Body() createDto: CreateDocumentoSoporteDto, @Req() req: AuthenticatedRequest) {
        const documento = await this.documentosSoportesService.create(createDto, req.user.sub);
        return toDocumentoResponse(documento, 'Documento soporte creado exitosamente');
    }

    @Get()
    @Permissions(Permission.PURCHASE_READ)
    async findAll(@Query() pagination: DocumentoSoporteFilterDto) {
        const result = await this.documentosSoportesService.findAll(pagination);
        return toDocumentoResponse(result.data, 'Documentos soporte obtenidos exitosamente', result.meta);
    }

    @Get(':id/notas-resumen')
    @Permissions(Permission.PURCHASE_READ)
    async getNotasResumen(@Param('id') id: string) {
        const resumen = await this.documentosSoportesService.getNotasResumen(id);
        return { success: true, data: resumen, message: 'Resumen de notas obtenido exitosamente' };
    }

    @Get(':id/pdf')
    @Permissions(Permission.PURCHASE_READ)
    async descargarPdf(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
        const { buffer, fileName } = await this.documentosSoportesService.descargarPdf(id);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
        });
        return new StreamableFile(buffer);
    }

    @Get(':id')
    @Permissions(Permission.PURCHASE_READ)
    async findOne(@Param('id') id: string) {
        const documento = await this.documentosSoportesService.findOne(id);
        return toDocumentoResponse([documento], 'Documento soporte obtenido exitosamente');
    }

    @Patch(':id')
    @Permissions(Permission.PURCHASE_UPDATE)
    async update(@Param('id') id: string, @Body() updateDto: UpdateDocumentoSoporteDto) {
        const documento = await this.documentosSoportesService.update(id, updateDto);
        return toDocumentoResponse(documento, 'Documento soporte actualizado exitosamente');
    }

    @Patch(':id/registrar')
    @Permissions(Permission.PURCHASE_UPDATE)
    async registrar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        const documento = await this.documentosSoportesService.registrar(id, req.user.sub);
        return toDocumentoResponse(documento, 'Documento soporte registrado exitosamente');
    }

    @Post(':id/emitir')
    @Permissions(Permission.PURCHASE_UPDATE)
    async emitir(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        const documento = await this.documentosSoportesService.emitir(id, req.user.sub);
        return toDocumentoResponse(documento, 'Documento soporte emitido a la DIAN exitosamente');
    }

    @Patch(':id/anular')
    @Permissions(Permission.PURCHASE_DELETE)
    async anular(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        const documento = await this.documentosSoportesService.anular(id, req.user.sub);
        return toDocumentoResponse(documento, 'Documento soporte anulado exitosamente');
    }

    @Delete(':id')
    @Permissions(Permission.PURCHASE_DELETE)
    async remove(@Param('id') id: string) {
        await this.documentosSoportesService.remove(id);
        return toDocumentoResponse([], 'Documento soporte eliminado exitosamente');
    }

    @Post(':id/reintentar-asiento')
    @Permissions(Permission.PURCHASE_UPDATE)
    async reintentarAsiento(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
        const documento = await this.documentosSoportesService.reintentarAsiento(id, req.user.sub);
        return toDocumentoResponse(documento, 'Reintento de asiento contable exitoso');
    }
}
