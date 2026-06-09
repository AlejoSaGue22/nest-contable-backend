import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { ImpuestosService } from './impuestos.service';
import { CreateImpuestoDto } from './dto/create-impuesto.dto';
import { UpdateImpuestoDto } from './dto/update-impuesto.dto';

@Controller('settings/impuestos')
export class ImpuestosController {
  constructor(private readonly impuestosService: ImpuestosService) {}

  @Post()
  create(@Body() createImpuestoDto: CreateImpuestoDto) {
    return this.impuestosService.create(createImpuestoDto);
  }

  @Get()
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.impuestosService.findAll(+page, +limit, search);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.impuestosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateImpuestoDto: UpdateImpuestoDto) {
    return this.impuestosService.update(id, updateImpuestoDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.impuestosService.remove(id);
  }
}
