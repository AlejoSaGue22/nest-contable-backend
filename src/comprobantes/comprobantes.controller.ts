import {
  Query,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import {
  CreateTipoComprobanteDto,
  UpdateTipoComprobanteDto,
} from './dto/tipo-comprobante.dto';
import {
  CreateComprobanteContableDto,
  UpdateComprobanteContableDto,
  AnularComprobanteDto,
} from './dto/comprobante-contable.dto';

@Controller('comprobantes')
@UseGuards(AuthGuard, RolesGuard)
export class ComprobantesController {
  constructor(private readonly service: ComprobantesService) { }

  // --------------------------------------------------------------------------------------------------
  // 1. ENDPOINTS DE TIPOS DE COMPROBANTES (CONFIGURACION)
  // --------------------------------------------------------------------------------------------------

  @Post('tipos')
  createTipo(@Body() dto: CreateTipoComprobanteDto) {
    return this.service.createTipo(dto);
  }

  @Get('tipos')
  findAllTipos() {
    return this.service.findAllTipos();
  }

  @Get('tipos/:id')
  findOneTipo(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneTipo(id);
  }

  @Patch('tipos/:id')
  updateTipo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTipoComprobanteDto,
  ) {
    return this.service.updateTipo(id, dto);
  }

  // --------------------------------------------------------------------------------------------------
  // 2. ENDPOINTS DE GESTION DE COMPROBANTES
  // --------------------------------------------------------------------------------------------------

  @Post()
  create(
    @Body() dto: CreateComprobanteContableDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    return this.service.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComprobanteContableDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    return this.service.update(id, dto, userId);
  }

  @Post(':id/contabilizar')
  contabilizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    return this.service.contabilizar(id, userId);
  }

  @Post(':id/anular')
  anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnularComprobanteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    return this.service.anular(id, dto.motivoAnulacion, userId);
  }
}


