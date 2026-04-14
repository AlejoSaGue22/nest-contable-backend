import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

@Controller('cuentas-bancarias')
@UseGuards(AuthGuard, RolesGuard)
export class CuentasBancariasController {
  constructor(private readonly cuentasBancariasService: CuentasBancariasService) { }

  @Post()
  @Permissions(Permission.ACCOUNTING_MANAGE)
  create(@Body() createCuentasBancariaDto: CreateCuentasBancariaDto) {
    return this.cuentasBancariasService.create(createCuentasBancariaDto);
  }

  @Get()
  @Permissions(Permission.ACCOUNTING_MANAGE)
  findAll(@Query() paginationDto: PaginatioDto) {
    return this.cuentasBancariasService.findAll(paginationDto);
  }

  @Get(':id')
  @Permissions(Permission.ACCOUNTING_MANAGE)
  findOne(@Param('id') id: string) {
    return this.cuentasBancariasService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.ACCOUNTING_MANAGE)
  update(@Param('id') id: string, @Body() updateCuentasBancariaDto: UpdateCuentasBancariaDto) {
    return this.cuentasBancariasService.update(id, updateCuentasBancariaDto);
  }

  @Delete(':id')
  @Permissions(Permission.ACCOUNTING_MANAGE)
  remove(@Param('id') id: string) {
    return this.cuentasBancariasService.remove(id);
  }
}
