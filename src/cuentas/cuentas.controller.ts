import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';
import { FilterCuentaDto } from './dto/filter-cuenta.dto';

@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentasService: CuentasService) { }

  @Post()
  create(@Body() createCuentaDto: CreateCuentaDto) {
    return this.cuentasService.create(createCuentaDto);
  }

  @Get()
  findAll(@Query() filterDto: FilterCuentaDto) {
    return this.cuentasService.findAll(filterDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // return this.cuentasService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCuentaDto: UpdateCuentaDto) {
    // return this.cuentasService.update(+id, updateCuentaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    // return this.cuentasService.remove(+id);
  }
}
