import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesCarteraService } from './reportes-cartera.service';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';

@Controller('reportes/cartera')
@UseGuards(AuthGuard, RolesGuard)
export class ReportesCarteraController {
  constructor(private readonly service: ReportesCarteraService) { }

  /** GET /reportes/cartera/resumen — Widget del dashboard */
  @Get('resumen')
  @Permissions(Permission.REPORT_VIEW)
  resumen() {
    return this.service.resumenCartera();
  }

  /** GET /reportes/cartera/aging-cobrar — CxC aging */
  @Get('aging-cobrar')
  @Permissions(Permission.REPORT_VIEW)
  agingCobrar() {
    return this.service.agingCobrar();
  }

  /** GET /reportes/cartera/aging-pagar — CxP aging */
  @Get('aging-pagar')
  @Permissions(Permission.REPORT_VIEW)
  agingPagar() {
    return this.service.agingPagar();
  }

  /** GET /reportes/cartera/reporte-aging-cobrar — CxC aging con filtros para reportes */
  @Get('reporte-aging-cobrar')
  @Permissions(Permission.REPORT_VIEW)
  reporteAgingCobrar(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin')    fechaFin:    string,
  ) {
    return this.service.agingCobrar(
      fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin    ? new Date(fechaFin)    : undefined
    );
  }

  /** GET /reportes/cartera/reporte-aging-pagar — CxP aging con filtros para reportes */
  @Get('reporte-aging-pagar')
  @Permissions(Permission.REPORT_VIEW)
  reporteAgingPagar(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin')    fechaFin:    string,
  ) {
    return this.service.agingPagar(
      fechaInicio ? new Date(fechaInicio) : undefined,
      fechaFin    ? new Date(fechaFin)    : undefined
    );
  }

  /**
   * GET /reportes/cartera/historial-pagos
   * ?fechaInicio=2025-01-01&fechaFin=2025-12-31
   */
  @Get('historial-pagos')
  @Permissions(Permission.REPORT_VIEW)
  historialPagos(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin')    fechaFin:    string,
  ) {
    return this.service.historialPagos(
      new Date(fechaInicio),
      new Date(fechaFin),
    );
  }
}