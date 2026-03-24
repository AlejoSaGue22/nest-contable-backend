import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { ReportesService } from './reportes.service';

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

  // =========================================================================
  // ENDPOINTS REPORTES AVANZADOS
  // =========================================================================

  @Get('facturacion-detallada')
  @Permissions(Permission.REPORT_READ)
  async facturacionAvanzada(@Query('fechaInicio') inicio: string, @Query('fechaFin') fin: string) {
    return await this.reportesService.generarReporteFacturacionAvanzada(new Date(inicio), new Date(fin));
  }

  @Get('conciliacion-dian')
  @Permissions(Permission.REPORT_READ)
  async conciliacionDian(@Query('fechaInicio') inicio: string, @Query('fechaFin') fin: string) {
    return await this.reportesService.generarReporteConciliacionDIAN(new Date(inicio), new Date(fin));
  }

  @Get('conciliacion-recaudos')
  @Permissions(Permission.REPORT_READ)
  async conciliacionRecaudos(@Query('fechaInicio') inicio: string, @Query('fechaFin') fin: string) {
    return await this.reportesService.generarReporteConciliacionRecaudos(new Date(inicio), new Date(fin));
  }

  @Get('impuestos-detallado')
  @Permissions(Permission.REPORT_READ)
  async impuestosAvanzado(@Query('fechaInicio') inicio: string, @Query('fechaFin') fin: string) {
    return await this.reportesService.generarReporteImpuestosAvanzado(new Date(inicio), new Date(fin));
  }

  @Get('dashboard-avanzado')
  @Permissions(Permission.REPORT_READ)
  async dashboardAvanzado() {
    return await this.reportesService.generarDashboardAvanzado();
  }
}
