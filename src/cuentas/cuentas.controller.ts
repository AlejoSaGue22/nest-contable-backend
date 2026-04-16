import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';
import { FilterCuentaDto } from './dto/filter-cuenta.dto';

@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentasService: CuentasService) { }

  @Get()
  findAll(@Query() filterDto: FilterCuentaDto) {
    return this.cuentasService.findAll(filterDto);
  }

}
