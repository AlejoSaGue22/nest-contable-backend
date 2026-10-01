import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { ArticulosService } from './articulos.service';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { CreateArticuloDto } from './dto/create-articulos.dto';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { UpdateArticuloDto } from './dto/update-articulos.dto';

@Controller('articulos')
@UseGuards(AuthGuard)
export class ArticulosController {
  constructor(private readonly articulosService: ArticulosService) { }

  @Post()
  create(@Body() createArticuloDto: CreateArticuloDto, @Req() req: AuthenticatedRequest) {
    return this.articulosService.createConCuentas(createArticuloDto, req.user.email);
  }

  @Get()
  findAll(@Query() pagination: PaginatioDto) {
    return this.articulosService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articulosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateArticuloDto: UpdateArticuloDto) {
    return this.articulosService.update(id, updateArticuloDto);
  }

  @Delete('delete/:id')
  remove(@Param('id') id: string) {
    return this.articulosService.remove(id);
  }

}
