import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { NominaService } from './nomina.service';
import { NominaDianService } from './services/nomina-dian.service';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { CreatePeriodoDto } from './dto/create-periodo.dto';
import { LiquidarNominaDto } from './dto/liquidar-nomina.dto';
import { PagarNominaDto } from './dto/pagar-nomina.dto';
import { GetEmpleadosFilterDto } from './dto/get-empleados-filter.dto';
import { CreateConceptoDto } from './dto/create-concepto.dto';
import { CreateEmpleadoConceptoDto } from './dto/create-empleado-concepto.dto';
import { AssignPeriodoEmpleadosDto } from './dto/assign-periodo-empleados.dto';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';

@Controller('nomina')
@UseGuards(AuthGuard, RolesGuard)
export class NominaController {
  constructor(
    private readonly nominaService: NominaService,
    private readonly nominaDianService: NominaDianService,
  ) { }

  // ── Empleados ──────────────────────────────────────────────────────────
  @Post('empleados')
  // @Permissions(Permission.NOMINA_EMPLOYEE_CREATE)
  createEmpleado(@Body() dto: CreateEmpleadoDto) {
    return this.nominaService.createEmpleado(dto);
  }

  @Get('empleados')
  // @Permissions(Permission.NOMINA_EMPLOYEE_READ)
  findAllEmpleados(@Query() pagination: GetEmpleadosFilterDto) {
    return this.nominaService.findAllEmpleados(pagination);
  }

  @Get('empleados/:id')
  // @Permissions(Permission.NOMINA_EMPLOYEE_READ)
  findOneEmpleado(@Param('id') id: string) {
    return this.nominaService.findOneEmpleado(id);
  }

  @Patch('empleados/:id')
  // @Permissions(Permission.NOMINA_EMPLOYEE_UPDATE)
  updateEmpleado(@Param('id') id: string, @Body() dto: UpdateEmpleadoDto) {
    return this.nominaService.updateEmpleado(id, dto);
  }

  @Delete('empleados/:id')
  // @Permissions(Permission.NOMINA_EMPLOYEE_DELETE)
  removeEmpleado(@Param('id') id: string) {
    return this.nominaService.removeEmpleado(id);
  }

  // ── Períodos ───────────────────────────────────────────────────────────
  @Post('periodos')
  // @Permissions(Permission.NOMINA_PERIOD_CREATE)
  createPeriodo(@Body() dto: CreatePeriodoDto) {
    return this.nominaService.createPeriodo(dto);
  }

  @Get('periodos')
  // @Permissions(Permission.NOMINA_PERIOD_READ)
  findAllPeriodos(@Query() pagination: PaginatioDto) {
    return this.nominaService.findAllPeriodos(pagination);
  }

  @Get('periodos/:id')
  // @Permissions(Permission.NOMINA_PERIOD_READ)
  findOnePeriodo(@Param('id') id: string) {
    return this.nominaService.findOnePeriodo(id);
  }

  // ── Liquidación ────────────────────────────────────────────────────────
  @Post('periodos/:id/liquidar')
  // @Permissions(Permission.NOMINA_PERIOD_LIQUIDATE)
  liquidarPeriodo(
    @Param('id') id: string,
    @Body() dto: LiquidarNominaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.nominaService.liquidarPeriodo(id, dto, req.user.sub);
  }

  @Get('periodos/:id/liquidaciones')
  // @Permissions(Permission.NOMINA_PERIOD_READ)
  findLiquidaciones(@Param('id') id: string) {
    return this.nominaService.findLiquidacionesByPeriodo(id);
  }

  @Post('periodos/:id/pagar')
  // @Permissions(Permission.NOMINA_PERIOD_PAY)
  pagarNomina(
    @Param('id') id: string,
    @Body() dto: PagarNominaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.nominaService.pagarNomina(id, dto, req.user.sub);
  }

  @Post('periodos/:id/anular')
  // @Permissions(Permission.NOMINA_PERIOD_ANUL)
  anularNomina(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.nominaService.anularNomina(id, req.user.sub);
  }

  // ── Pagos ──────────────────────────────────────────────────────────────
  @Get('pagos')
  // @Permissions(Permission.NOMINA_PERIOD_READ)
  findAllPagos(@Query() pagination: PaginatioDto) {
    return this.nominaService.findAllPagos(pagination);
  }

  @Get('pagos/periodo/:periodoId')
  // @Permissions(Permission.NOMINA_PERIOD_READ)
  findPagosByPeriodo(@Param('periodoId') periodoId: string) {
    return this.nominaService.findPagosByPeriodo(periodoId);
  }

  // ── DIAN / Nómina Electrónica ──────────────────────────────────────────
  @Post('periodos/:id/enviar-dian')
  // @Permissions(Permission.NOMINA_DIAN_SEND)
  enviarDian(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.nominaDianService.generarEnviarDian(id, req.user.sub);
  }

  @Get('periodos/:id/descargar-xml')
  // @Permissions(Permission.NOMINA_DIAN_SEND)
  async descargarXml(@Param('id') id: string, @Res() res: Response) {
    const { xml, nombre } = await this.nominaDianService.descargarXmlDian(id);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(xml);
  }

  // ── Catálogos ──────────────────────────────────────────────────────────
  @Get('entidades-seguridad')
  findAllEntidadesSS(@Query('tipo') tipo?: string) {
    return this.nominaService.findAllEntidadesSS(tipo);
  }

  @Get('cargos')
  findAllCargos() {
    return this.nominaService.findAllCargos();
  }

  @Get('centros-costo')
  findAllCentrosCosto() {
    return this.nominaService.findAllCentrosCosto();
  }

  @Get('tipos-contrato')
  findAllTiposContrato() {
    return this.nominaService.findAllTiposContrato();
  }

  // ── Reportes ───────────────────────────────────────────────────────────
  @Get('reportes/costos-centro-costo')
  @Permissions(Permission.NOMINA_REPORT_READ)
  async costosPorCentroCosto(@Query('fechaInicio') fechaInicio: string, @Query('fechaFin') fechaFin: string) {
    return this.nominaService.reporteCostosPorCentroCosto(fechaInicio, fechaFin);
  }

  @Get('reportes/costos-cargo')
  @Permissions(Permission.NOMINA_REPORT_READ)
  async costosPorCargo(@Query('fechaInicio') fechaInicio: string, @Query('fechaFin') fechaFin: string) {
    return this.nominaService.reporteCostosPorCargo(fechaInicio, fechaFin);
  }

  @Get('reportes/comparativo')
  @Permissions(Permission.NOMINA_REPORT_READ)
  async comparativoPeriodos(@Query('periodo1Id') periodo1Id: string, @Query('periodo2Id') periodo2Id: string) {
    return this.nominaService.reporteComparativoPeriodos(periodo1Id, periodo2Id);
  }

  @Get('reportes/resumen-aportes/:periodoId')
  @Permissions(Permission.NOMINA_REPORT_READ)
  async resumenAportes(@Param('periodoId') periodoId: string) {
    return this.nominaService.reporteResumenAportes(periodoId);
  }
}
