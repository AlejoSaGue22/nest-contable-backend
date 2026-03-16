import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';

@Controller('cuentas-bancarias')
@UseGuards(AuthGuard, RolesGuard)
export class CuentasBancariasController {
  constructor(private readonly cuentasBancariasService: CuentasBancariasService) { }

  @Post()
  create(@Body() createCuentasBancariaDto: CreateCuentasBancariaDto) {
    return this.cuentasBancariasService.create(createCuentasBancariaDto);
  }

  @Get()
  findAll() {
    return this.cuentasBancariasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cuentasBancariasService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCuentasBancariaDto: UpdateCuentasBancariaDto) {
    return this.cuentasBancariasService.update(+id, updateCuentasBancariaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cuentasBancariasService.remove(+id);
  }
}
