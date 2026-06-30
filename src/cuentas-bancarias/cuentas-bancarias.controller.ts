import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';
import { CuentasBancariasPaginationDto } from './dto/cuentas-bancarias-pagination.dto';

@Controller('cuentas-bancarias')
@UseGuards(AuthGuard, RolesGuard)
export class CuentasBancariasController {
  constructor(private readonly cuentasBancariasService: CuentasBancariasService) { }

  @Post()
  @Permissions(Permission.ACCOUNTING_MANAGE)
  create(@Body() createCuentasBancariaDto: CreateCuentasBancariaDto, @Req() req: AuthenticatedRequest) {
    return this.cuentasBancariasService.create(createCuentasBancariaDto, req.user.sub);
  }

  @Post('transferir')
  @Permissions(Permission.ACCOUNTING_MANAGE)
  transferir(@Body() dto: CreateTransferenciaDto, @Req() req: AuthenticatedRequest) {
    return this.cuentasBancariasService.transferir(dto, req.user.sub);
  }

  @Get()
  @Permissions(Permission.ACCOUNTING_MANAGE)
  findAll(@Query() paginationDto: CuentasBancariasPaginationDto) {
    return this.cuentasBancariasService.findAll(paginationDto);
  }

  @Get(':id')
  @Permissions(Permission.ACCOUNTING_MANAGE)
  findOne(@Param('id') id: string) {
    return this.cuentasBancariasService.findOne(id);
  }

  @Patch('toggle-status/:id')
  @Permissions(Permission.ACCOUNTING_MANAGE)
  toggleStatus(@Param('id') id: string) {
    return this.cuentasBancariasService.toggleStatus(id);
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
