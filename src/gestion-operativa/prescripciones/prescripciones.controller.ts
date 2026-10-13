import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
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
import { SaveTipoExamenDto } from './dto/save-tipo-examen.dto';
import { SaveProfesionalResponsableDto } from './dto/save-profesional-responsable.dto';
import { UpdateTipoExamenDto } from './dto/update-tipo-examen.dto';
import { UpdateProfesionalResponsableDto } from './dto/update-profesional-responsable.dto';
import { resolveEmpresaId } from 'src/common/tenant/tenant.helpers';

@Controller('prescripciones')
@UseGuards(AuthGuard, RolesGuard)
export class PrescripcionesController {
  constructor(private readonly service: PrescripcionesService) { }

  @Get('catalogos/tipos-examen') @Permissions(Permission.INVOICE_READ)
  async listTiposExamen(@Req() request: Request) {
    return { success: true, data: await this.service.listTiposExamen(resolveEmpresaId(request)) };
  }

  @Post('catalogos/tipos-examen') @Permissions(Permission.INVOICE_CREATE)
  async createTipoExamen(@Body() dto: SaveTipoExamenDto, @Req() request: Request) {
    return { success: true, data: await this.service.createTipoExamen(dto, resolveEmpresaId(request)) };
  }

  @Patch('catalogos/tipos-examen/:id') @Permissions(Permission.INVOICE_UPDATE)
  async updateTipoExamen(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTipoExamenDto, @Req() request: Request) {
    return { success: true, data: await this.service.updateTipoExamen(id, dto, resolveEmpresaId(request)) };
  }

  @Get('catalogos/profesionales') @Permissions(Permission.INVOICE_READ)
  async listProfesionales(@Req() request: Request, @Query('includeInactive') includeInactive?: string) {
    return { success: true, data: await this.service.listProfesionales(resolveEmpresaId(request), includeInactive === 'true') };
  }

  @Post('catalogos/profesionales') @Permissions(Permission.INVOICE_CREATE)
  async createProfesional(@Body() dto: SaveProfesionalResponsableDto, @Req() request: Request) {
    return { success: true, data: await this.service.createProfesional(dto, resolveEmpresaId(request)) };
  }

  @Patch('catalogos/profesionales/:id') @Permissions(Permission.INVOICE_UPDATE)
  async updateProfesional(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProfesionalResponsableDto, @Req() request: Request) {
    return { success: true, data: await this.service.updateProfesional(id, dto, resolveEmpresaId(request)) };
  }

  @Post('catalogos/profesionales/:id/firma')
  @Permissions(Permission.INVOICE_UPDATE)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const empresaFolder = resolveEmpresaId(req) || 'general';
        const uploadPath = `./uploads/empresas/${empresaFolder}/firmas`;
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `firma-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp|svg\+xml)$/)) {
        return cb(new BadRequestException('La firma debe ser una imagen JPG, PNG, WEBP o SVG'), false);
      }
      cb(null, true);
    },
  }))
  async uploadFirma(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: any, @Req() request: Request) {
    if (!file) throw new BadRequestException('No se ha proporcionado ningún archivo de firma');
    const empresaFolder = resolveEmpresaId(request) || 'general';
    const firmaUrl = `/uploads/empresas/${empresaFolder}/firmas/${file.filename}`;
    return { success: true, data: await this.service.setFirmaProfesional(id, firmaUrl, resolveEmpresaId(request)), firmaUrl };
  }

  @Get() @Permissions(Permission.INVOICE_READ)
  async findAll(@Query() filter: PrescripcionFilterDto, @Req() request: Request) {
    return { success: true, ...(await this.service.findAll(filter, resolveEmpresaId(request))) };
  }

  @Get('history/:clienteId') @Permissions(Permission.INVOICE_READ)
  async history(@Param('clienteId', ParseUUIDPipe) clienteId: string, @Req() request: Request) {
    return { success: true, data: await this.service.history(clienteId, resolveEmpresaId(request)) };
  }

  @Get(':id') @Permissions(Permission.INVOICE_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return { success: true, data: await this.service.findOne(id, resolveEmpresaId(request)) };
  }

  @Post() @Permissions(Permission.INVOICE_CREATE)
  async create(@Body() dto: CreatePrescripcionDto, @CurrentUser() user: User, @Req() request: Request) {
    return { success: true, data: await this.service.create(dto, user.id, resolveEmpresaId(request)) };
  }

  @Patch(':id') @Permissions(Permission.INVOICE_UPDATE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePrescripcionDto, @Req() request: Request) {
    return { success: true, data: await this.service.update(id, dto, resolveEmpresaId(request)) };
  }

  @Delete(':id') @Permissions(Permission.INVOICE_DELETE)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return { success: true, data: await this.service.cancel(id, resolveEmpresaId(request)) };
  }
}
