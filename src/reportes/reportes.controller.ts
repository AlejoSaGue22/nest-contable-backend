import { Controller, Get, Query } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';

@Controller('reportes')
@UseGuards(AuthGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) { }

  @Get('estado-resultados')
  @Permissions(Permission.REPORT_READ)
  async estadoResultados(@Query('fechaInicio') fechaInicio: string, @Query('fechaFin') fechaFin: string) {
    return await this.reportesService.generarEstadoResultados(new Date(fechaInicio), new Date(fechaFin));
  }

  @Get('flujo-caja')
  @Permissions(Permission.REPORT_READ)
  async flujoCaja(@Query('fechaInicio') fechaInicio: string, @Query('fechaFin') fechaFin: string) {
    return await this.reportesService.generarFlujoCaja(new Date(fechaInicio), new Date(fechaFin));
  }

  @Get('balance-general')
  @Permissions(Permission.REPORT_READ)
  async balanceGeneral(@Query('fecha') fecha: string) {
    return await this.reportesService.generarBalanceGeneral(new Date(fecha));
  }
}
