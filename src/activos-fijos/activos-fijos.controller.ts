import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { ActivosFijosService } from './activos-fijos.service';
import { CreateActivoFijoDto } from './dto/create-activo-fijo.dto';
import { UpdateActivoFijoDto } from './dto/update-activo-fijo.dto';
import { DepreciarPeriodoDto } from './dto/depreciar-periodo.dto';
import { RetirarActivoDto } from './dto/retirar-activo.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';

@Controller('activos-fijos')
@UseGuards(AuthGuard)
export class ActivosFijosController {
  constructor(private readonly activosService: ActivosFijosService) { }

  @Post()
  create(@Body() createDto: CreateActivoFijoDto) {
    return this.activosService.create(createDto);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.activosService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activosService.findOne(id);
  }

  @Get(':id/depreciaciones')
  getDepreciaciones(@Param('id') id: string) {
    return this.activosService.getDepreciaciones(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateActivoFijoDto) {
    return this.activosService.update(id, updateDto);
  }

  @Post('depreciar')
  depreciarPeriodo(@Body() dto: DepreciarPeriodoDto, @Req() req: AuthenticatedRequest) {
    return this.activosService.depreciarPeriodo(dto, req.user.sub);
  }

  @Post(':id/retirar')
  retirarActivo(@Param('id') id: string, @Body() dto: RetirarActivoDto, @Req() req: AuthenticatedRequest) {
    return this.activosService.retirarActivo(id, dto, req.user.sub);
  }
}

