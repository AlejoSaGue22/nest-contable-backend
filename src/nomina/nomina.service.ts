import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { PeriodoNomina } from './entities/periodo-nomina.entity';
import { Liquidacion } from './entities/liquidacion.entity';
import { PagoNomina } from './entities/pago-nomina.entity';
import { Banco } from 'src/bancos/entities/banco.entity';
import {
  EntidadSeguridadSocial,
  TipoEntidadSS,
} from './entities/entidad-seguridad-social.entity';
import { TipoContratoEntity } from './entities/tipo-contrato.entity';
import { TipoContrato } from './enums/tipo-contrato.enum';
import { Cargo } from './entities/cargo.entity';
import { CentroCosto } from './entities/centro-costo.entity';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { CreatePeriodoDto } from './dto/create-periodo.dto';
import { LiquidarNominaDto } from './dto/liquidar-nomina.dto';
import { PagarNominaDto } from './dto/pagar-nomina.dto';
import { GetEmpleadosFilterDto } from './dto/get-empleados-filter.dto';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { EstadoPeriodoNomina } from './enums/estado-periodo.enum';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { AsientoContable } from 'src/asientos-contables/entities/asientos-contable.entity';

const SMMLV_2026 = 1423500;
const AUXILIO_TRANSPORTE_2026 = 200000;

@Injectable()
export class NominaService {
  private readonly logger = new Logger(NominaService.name);

  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepo: Repository<Empleado>,
    @InjectRepository(PeriodoNomina)
    private readonly periodoRepo: Repository<PeriodoNomina>,
    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,
    @InjectRepository(EntidadSeguridadSocial)
    private readonly entidadSSRepo: Repository<EntidadSeguridadSocial>,
    @InjectRepository(Cargo)
    private readonly cargoRepo: Repository<Cargo>,
    @InjectRepository(CentroCosto)
    private readonly centroCostoRepo: Repository<CentroCosto>,
    @InjectRepository(PagoNomina)
    private readonly pagoNominaRepo: Repository<PagoNomina>,
    @InjectRepository(TipoContratoEntity)
    private readonly tipoContratoRepo: Repository<TipoContratoEntity>,
    private readonly asientosContablesService: AsientosContablesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  //  EMPLEADOS
  // ═══════════════════════════════════════════════════════════════════

  async createEmpleado(dto: CreateEmpleadoDto) {
    try {
      const cleanedDto = this.cleanEmptyStrings(dto);

      const exists = await this.empleadoRepo.findOne({
        where: { numeroDocumento: cleanedDto.numeroDocumento },
      });
      if (exists) {
        throw new BadRequestException(
          `Ya existe un empleado con el número de documento ${cleanedDto.numeroDocumento}`,
        );
      }

      if (cleanedDto.tipoContratoId) {
        const tipo = await this.tipoContratoRepo.findOne({
          where: { id: cleanedDto.tipoContratoId },
        });
        if (!tipo)
          throw new NotFoundException('Tipo de contrato no encontrado');
        (cleanedDto as any).tipoContrato = tipo.codigo;
      }

      if (cleanedDto.epsId) {
        const eps = await this.entidadSSRepo.findOne({
          where: { id: cleanedDto.epsId },
        });
        if (!eps) throw new NotFoundException('Entidad EPS no encontrada');
      }

      if (cleanedDto.afpId) {
        const afp = await this.entidadSSRepo.findOne({
          where: { id: cleanedDto.afpId },
        });
        if (!afp) throw new NotFoundException('Entidad AFP no encontrada');
      }

      const empleado = this.empleadoRepo.create(cleanedDto);
      const saved = await this.empleadoRepo.save(empleado);
      return await this.findOneEmpleado(saved.id);
    } catch (error) {
      this.logger.error(
        `Error al crear empleado: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findAllEmpleados(paginationDto: GetEmpleadosFilterDto) {
    const page = paginationDto.offset || 1;
    const limit = paginationDto.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = this.empleadoRepo.createQueryBuilder('empleado');

    queryBuilder
      .leftJoinAndSelect('empleado.eps', 'eps')
      .leftJoinAndSelect('empleado.afp', 'afp')
      .leftJoinAndSelect('empleado.ccf', 'ccf')
      .leftJoinAndSelect('empleado.cargo', 'cargo')
      .leftJoinAndSelect('empleado.centroCosto', 'centroCosto')
      .leftJoinAndSelect('empleado.banco', 'banco')
      .leftJoinAndSelect('empleado.tipoContratoRel', 'tipoContratoRel');

    if (paginationDto.activo !== undefined && paginationDto.activo !== '') {
      const isActivo = paginationDto.activo === 'true' || (paginationDto.activo as any) === true;
      queryBuilder.andWhere('empleado.activo = :activo', { activo: isActivo });
    }

    if (paginationDto.cargoId) {
      queryBuilder.andWhere('empleado.cargoId = :cargoId', { cargoId: paginationDto.cargoId });
    }

    if (paginationDto.search) {
      const searchPattern = `%${paginationDto.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(empleado.primerNombre) LIKE :search OR LOWER(empleado.primerApellido) LIKE :search OR LOWER(empleado.numeroDocumento) LIKE :search OR LOWER(empleado.segundoNombre) LIKE :search OR LOWER(empleado.segundoApellido) LIKE :search)',
        { search: searchPattern }
      );
    }

    queryBuilder
      .orderBy('empleado.primerApellido', 'ASC')
      .take(limit)
      .skip(skip);

    const [empleados, total] = await queryBuilder.getManyAndCount();

    return {
      count: total,
      pages: Math.ceil(total / limit),
      data: empleados,
    };
  }

  async findOneEmpleado(id: string) {
    const empleado = await this.empleadoRepo.findOne({
      where: { id },
      relations: [
        'eps',
        'afp',
        'ccf',
        'cargo',
        'centroCosto',
        'banco',
        'tipoContratoRel',
      ],
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    return empleado;
  }

  async updateEmpleado(id: string, dto: UpdateEmpleadoDto) {
    try {
      const cleanedDto = this.cleanEmptyStrings(dto);

      if (cleanedDto.tipoContratoId) {
        const tipo = await this.tipoContratoRepo.findOne({
          where: { id: cleanedDto.tipoContratoId },
        });
        if (!tipo)
          throw new NotFoundException('Tipo de contrato no encontrado');
        (cleanedDto as any).tipoContrato = tipo.codigo;
      }

      if (cleanedDto.epsId) {
        const eps = await this.entidadSSRepo.findOne({
          where: { id: cleanedDto.epsId },
        });
        if (!eps) throw new NotFoundException('Entidad EPS no encontrada');
      }

      if (cleanedDto.afpId) {
        const afp = await this.entidadSSRepo.findOne({
          where: { id: cleanedDto.afpId },
        });
        if (!afp) throw new NotFoundException('Entidad AFP no encontrada');
      }

      const empleado = await this.findOneEmpleado(id);
      this.empleadoRepo.merge(empleado, cleanedDto);
      return await this.empleadoRepo.save(empleado);
    } catch (error) {
      this.logger.error(
        `Error al actualizar empleado: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private cleanEmptyStrings<T>(obj: T): T {
    if (!obj) return obj;
    const cleaned = { ...obj };
    for (const key of Object.keys(cleaned as any)) {
      if ((cleaned as any)[key] === '') {
        (cleaned as any)[key] = null;
      }
    }
    return cleaned;
  }

  async removeEmpleado(id: string) {
    const empleado = await this.findOneEmpleado(id);
    return this.empleadoRepo.softRemove(empleado);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PERIODOS
  // ═══════════════════════════════════════════════════════════════════

  async createPeriodo(dto: CreatePeriodoDto) {
    const periodo = this.periodoRepo.create({
      ...dto,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: new Date(dto.fechaFin),
      fechaPago: dto.fechaPago ? new Date(dto.fechaPago) : undefined,
    });
    return this.periodoRepo.save(periodo);
  }

  async findAllPeriodos(paginationDto: PaginatioDto) {
    const page = paginationDto.offset || 1;
    const limit = paginationDto.limit || 10;
    const skip = (page - 1) * limit;

    const [periodos, total] = await this.periodoRepo.findAndCount({
      order: { fechaInicio: 'DESC' },
      take: limit,
      skip,
    });

    return {
      count: total,
      pages: Math.ceil(total / limit),
      data: periodos,
    };
  }

  async findOnePeriodo(id: string) {
    const periodo = await this.periodoRepo.findOne({ where: { id } });
    if (!periodo) throw new NotFoundException('Período no encontrado');
    return periodo;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LIQUIDACIÓN
  // ═══════════════════════════════════════════════════════════════════

  async liquidarPeriodo(
    periodoId: string,
    dto: LiquidarNominaDto,
    userId: string,
  ) {
    const periodo = await this.findOnePeriodo(periodoId);
    if (periodo.estado !== EstadoPeriodoNomina.BORRADOR) {
      throw new BadRequestException('El período no está en estado BORRADOR');
    }

    const liquidaciones: Liquidacion[] = [];
    const empleadosItems = dto.empleados?.length
      ? dto.empleados
      : (await this.empleadoRepo.find({ where: { activo: true } })).map(
          (e) => ({ empleadoId: e.id, diasTrabajados: 30 }),
        );

    for (const item of empleadosItems) {
      const empleado = await this.findOneEmpleado(item.empleadoId);
      const liq = await this.calcularLiquidacion(empleado, periodo, item);
      liquidaciones.push(liq);
    }

    const saved = await this.liquidacionRepo.save(liquidaciones);

    const totalDevengado = saved.reduce(
      (s, l) => s + Number(l.totalDevengado),
      0,
    );
    const totalDeducciones = saved.reduce(
      (s, l) => s + Number(l.totalDeducciones),
      0,
    );
    const totalNeto = saved.reduce((s, l) => s + Number(l.netoPagar), 0);
    const totalCosto = saved.reduce(
      (s, l) =>
        s +
        Number(l.totalDevengado) +
        Number(l.totalAportes) +
        Number(l.totalProvisiones),
      0,
    );
    const totalAportesPeriodo = saved.reduce(
      (s, l) => s + Number(l.totalAportes),
      0,
    );
    const totalProvisionesPeriodo = saved.reduce(
      (s, l) => s + Number(l.totalProvisiones),
      0,
    );
    const saludPension = saved.reduce(
      (s, l) => s + Number(l.saludEmpleado) + Number(l.pensionEmpleado),
      0,
    );
    const totalRetefuente = saved.reduce(
      (s, l) => s + Number(l.retencionFuente),
      0,
    );

    // Generar asiento contable de provisión
    const asiento = await this.asientosContablesService.generarAsientoNomina({
      periodoNombre: periodo.nombre,
      fecha: periodo.fechaFin,
      totalDevengado,
      totalProvisiones: totalProvisionesPeriodo,
      totalAportes: totalAportesPeriodo,
      netoPagar: totalNeto,
      saludPensionEmpleado: saludPension,
      retencionFuente: totalRetefuente,
      userId,
    });

    await this.periodoRepo.update(periodoId, {
      estado: EstadoPeriodoNomina.LIQUIDADA,
      totalDevengado,
      totalDeducciones,
      totalNeto,
      totalCostoEmpresa: totalCosto,
      asientoProvisionId: asiento.id,
    });

    return {
      message: 'Nómina liquidada exitosamente',
      data: saved,
      asientoProvision: asiento,
    };
  }

  async findLiquidacionesByPeriodo(periodoId: string) {
    return this.liquidacionRepo.find({
      where: { periodoId },
      relations: ['empleado', 'empleado.cargo', 'empleado.centroCosto'],
      order: { createdAt: 'ASC' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAGO Y ANULACIÓN
  // ═══════════════════════════════════════════════════════════════════

  async pagarNomina(periodoId: string, dto: PagarNominaDto, userId: string) {
    const periodo = await this.findOnePeriodo(periodoId);
    if (periodo.estado !== EstadoPeriodoNomina.LIQUIDADA) {
      throw new BadRequestException(
        'El período debe estar en estado LIQUIDADA para pagarlo',
      );
    }

    const asiento =
      await this.asientosContablesService.generarAsientoPagoNomina({
        periodoNombre: periodo.nombre,
        fecha: new Date(dto.fechaPago),
        netoPagar: Number(periodo.totalNeto),
        cuentaCodigoContable: dto.cuentaCodigoContable,
        userId,
      });

    const pagoNomina = new PagoNomina();
    pagoNomina.periodoId = periodoId;
    pagoNomina.fechaPago = new Date(dto.fechaPago);
    pagoNomina.valor = Number(periodo.totalNeto);
    pagoNomina.cuentaCodigoContable = dto.cuentaCodigoContable;
    pagoNomina.bancoId = dto.bancoId ?? null;
    pagoNomina.numeroComprobante = dto.numeroComprobante ?? null;
    pagoNomina.observaciones = dto.observaciones ?? null;
    pagoNomina.asientoPagoId = asiento.id;
    pagoNomina.createdById = userId;
    await this.pagoNominaRepo.save(pagoNomina);

    await this.periodoRepo.update(periodoId, {
      estado: EstadoPeriodoNomina.PAGADA,
      fechaPago: new Date(dto.fechaPago),
      asientoPagoId: asiento.id,
    });

    return {
      message: 'Nómina pagada exitosamente',
      pagoNomina,
      asientoPago: asiento,
    };
  }

  async findAllPagos(paginationDto: PaginatioDto) {
    const page = paginationDto.offset || 1;
    const limit = paginationDto.limit || 10;
    const skip = (page - 1) * limit;

    const [pagos, total] = await this.pagoNominaRepo.findAndCount({
      relations: ['periodo', 'banco'],
      order: { fechaPago: 'DESC' },
      take: limit,
      skip,
    });

    return {
      count: total,
      pages: Math.ceil(total / limit),
      data: pagos,
    };
  }

  async findPagosByPeriodo(periodoId: string) {
    await this.findOnePeriodo(periodoId);
    return this.pagoNominaRepo.find({
      where: { periodoId },
      relations: ['banco'],
      order: { createdAt: 'ASC' },
    });
  }

  async anularNomina(periodoId: string, userId: string) {
    const periodo = await this.findOnePeriodo(periodoId);
    if (periodo.estado === EstadoPeriodoNomina.BORRADOR) {
      throw new BadRequestException(
        'No se puede anular un período en estado BORRADOR',
      );
    }
    if (periodo.estado === EstadoPeriodoNomina.ANULADA) {
      throw new BadRequestException('El período ya está anulado');
    }

    // 1. Reversar asiento de pago (si existe — período PAGADA)
    if (periodo.asientoPagoId) {
      const asientoPago =
        await this.asientosContablesService.findOneAsientoConDetalles(
          periodo.asientoPagoId,
        );
      await this.asientosContablesService.anularAsientoNomina({
        periodoNombre: periodo.nombre,
        fecha: new Date(),
        asientoOriginal: asientoPago,
        userId,
      });
    }

    // 2. Reversar asiento de provisión (si existe)
    if (periodo.asientoProvisionId) {
      const asientoProvision =
        await this.asientosContablesService.findOneAsientoConDetalles(
          periodo.asientoProvisionId,
        );
      await this.asientosContablesService.anularAsientoNomina({
        periodoNombre: periodo.nombre,
        fecha: new Date(),
        asientoOriginal: asientoProvision,
        userId,
      });
    }

    await this.periodoRepo.update(periodoId, {
      estado: EstadoPeriodoNomina.ANULADA,
    });

    return {
      message: 'Nómina anulada exitosamente',
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CATÁLOGOS
  // ═══════════════════════════════════════════════════════════════════

  async findAllEntidadesSS(tipo?: string) {
    const where = tipo
      ? { tipo: tipo as TipoEntidadSS, activo: true }
      : { activo: true };
    return this.entidadSSRepo.find({ where, order: { nombre: 'ASC' } });
  }

  async findAllCargos() {
    return this.cargoRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async findAllCentrosCosto() {
    return this.centroCostoRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async findAllTiposContrato() {
    return this.tipoContratoRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CÁLCULOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════

  private async calcularLiquidacion(
    empleado: Empleado,
    periodo: PeriodoNomina,
    item: any,
  ): Promise<Liquidacion> {
    const dias = item.diasTrabajados;
    const salarioDiario = Number(empleado.salarioBase) / 30;

    // ── Devengados ──
    const salarioDevengado = Math.round(salarioDiario * dias * 100) / 100;

    const auxilioTransporte =
      empleado.auxilioTransporte &&
      Number(empleado.salarioBase) <= 2 * SMMLV_2026
        ? Math.round((AUXILIO_TRANSPORTE_2026 / 30) * dias * 100) / 100
        : 0;

    const totalHorasExtras = (item.horasExtras || []).reduce(
      (s, h) => s + Number(h.valor),
      0,
    );
    const totalBonificaciones = (item.bonificaciones || []).reduce(
      (s, b) => s + Number(b.valor),
      0,
    );
    const comisiones = item.comisiones || 0;

    const totalDevengado =
      Math.round(
        (salarioDevengado +
          auxilioTransporte +
          totalHorasExtras +
          totalBonificaciones +
          Number(comisiones)) *
          100,
      ) / 100;

    // ── IBC (Ingreso Base de Cotización) ──
    // Base: salario + auxilioTransporte (solo si salario <= 2 SMMLV) + extras + comisiones
    let ibcBase = salarioDevengado + totalHorasExtras + Number(comisiones);
    if (Number(empleado.salarioBase) <= 2 * SMMLV_2026) {
      ibcBase += auxilioTransporte;
    }
    const ibc = Math.round(ibcBase * 100) / 100;

    // ── Deducciones ──
    const saludEmpleado = Math.round(ibc * 0.04 * 100) / 100;
    const pensionEmpleado = Math.round(ibc * 0.04 * 100) / 100;
    const retencionFuente = this.calcularRetencionFuente(
      Number(empleado.salarioBase),
      totalDevengado,
      empleado.salarioIntegral,
    );

    const otrasDeducciones = item.otrasDeducciones || [];
    const totalOtrasDeducciones = otrasDeducciones.reduce(
      (s, d) => s + Number(d.valor),
      0,
    );

    const totalDeducciones =
      Math.round(
        (saludEmpleado +
          pensionEmpleado +
          retencionFuente +
          totalOtrasDeducciones) *
          100,
      ) / 100;

    const netoPagar =
      Math.round((totalDevengado - totalDeducciones) * 100) / 100;

    // ── Aportes empleador ──
    const tasasARL = [0, 0.00348, 0.01044, 0.02436, 0.0435, 0.087];
    const tasaARL = tasasARL[empleado.arlNivelRiesgo] || 0.00348;

    // Determinamos SENA/ICBF según tamaño de empresa (simplificado: aplica si no es servicio doméstico)
    const aplicaSENA = true;
    const aplicaICBF = true;

    const aportes = [
      { concepto: 'Salud', valor: Math.round(ibc * 0.085 * 100) / 100 },
      { concepto: 'Pensión', valor: Math.round(ibc * 0.12 * 100) / 100 },
      { concepto: 'ARL', valor: Math.round(ibc * tasaARL * 100) / 100 },
      {
        concepto: 'Caja Compensación',
        valor: Math.round(ibc * 0.04 * 100) / 100,
      },
      ...(aplicaSENA
        ? [{ concepto: 'SENA', valor: Math.round(ibc * 0.02 * 100) / 100 }]
        : []),
      ...(aplicaICBF
        ? [{ concepto: 'ICBF', valor: Math.round(ibc * 0.03 * 100) / 100 }]
        : []),
    ];
    const totalAportes = aportes.reduce((s, a) => s + a.valor, 0);

    // ── Provisiones ──
    const provisiones = [
      {
        concepto: 'Cesantías',
        valor: Math.round(((salarioDevengado * dias) / 360) * 100) / 100,
      },
      {
        concepto: 'Intereses Cesantías',
        valor: Math.round(((salarioDevengado * dias) / 360) * 0.12 * 100) / 100,
      },
      {
        concepto: 'Prima de Servicios',
        valor: Math.round(((salarioDevengado * dias) / 360) * 100) / 100,
      },
      {
        concepto: 'Vacaciones',
        valor:
          Math.round(((Number(empleado.salarioBase) * dias) / 720) * 100) / 100,
      },
    ];
    const totalProvisiones = provisiones.reduce((s, p) => s + p.valor, 0);

    const liq = this.liquidacionRepo.create({
      periodoId: periodo.id,
      empleadoId: empleado.id,
      diasTrabajados: dias,
      salarioDevengado,
      auxilioTransporte,
      horasExtras: item.horasExtras || [],
      totalHorasExtras,
      bonificaciones: item.bonificaciones || [],
      totalBonificaciones,
      comisiones: Number(comisiones),
      totalDevengado,
      saludEmpleado,
      pensionEmpleado,
      retencionFuente,
      otrasDeducciones,
      totalDeducciones,
      netoPagar,
      ibc,
      aportesEmpleador: aportes,
      totalAportes,
      provisiones,
      totalProvisiones,
    });

    return liq;
  }

  private calcularRetencionFuente(
    salarioBase: number,
    totalDevengado: number,
    salarioIntegral: boolean,
  ): number {
    if (salarioIntegral) {
      return Math.round(totalDevengado * 0.015 * 100) / 100;
    }

    const UVT = 51816;

    // 1. Deducción automática 25% (Art. 206 E.T.), tope 240 UVT mensuales
    const deduccion = Math.min(totalDevengado * 0.25, 240 * UVT);
    const baseMensual = totalDevengado - deduccion;

    // 2. Annualizar
    const baseAnual = baseMensual * 12;

    // 3. Tabla progresiva DIAN 2026 (Art. 383 E.T.)
    // 0-95 UVT: exento | 95-150: 19% | 150-360: 28% | 360+: 33%
    let impuestoAnual = 0;
    if (baseAnual > 95 * UVT) {
      const base95_150 = Math.min(baseAnual, 150 * UVT) - 95 * UVT;
      if (base95_150 > 0) impuestoAnual += base95_150 * 0.19;
    }
    if (baseAnual > 150 * UVT) {
      const base150_360 = Math.min(baseAnual, 360 * UVT) - 150 * UVT;
      if (base150_360 > 0) impuestoAnual += base150_360 * 0.28;
    }
    if (baseAnual > 360 * UVT) {
      impuestoAnual += (baseAnual - 360 * UVT) * 0.33;
    }

    return Math.round((impuestoAnual / 12) * 100) / 100;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  REPORTES
  // ═══════════════════════════════════════════════════════════════════

  async reporteCostosPorCentroCosto(fechaInicio?: string, fechaFin?: string) {
    const qb = this.liquidacionRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.empleado', 'e')
      .leftJoin('e.centroCosto', 'cc')
      .addSelect(['cc.id', 'cc.codigo', 'cc.nombre'])
      .leftJoin('l.periodo', 'p')
      .where('p.estado != :anulado', { anulado: EstadoPeriodoNomina.ANULADA });

    if (fechaInicio) qb.andWhere('p.fechaInicio >= :fi', { fi: fechaInicio });
    if (fechaFin) qb.andWhere('p.fechaFin <= :ff', { ff: fechaFin });

    const liquidaciones = await qb.getMany();

    const mapa = new Map<
      string,
      {
        centroCostoId: string;
        centroCostoCodigo: string;
        centroCostoNombre: string;
        empleados: number;
        totalDevengado: number;
        totalAportes: number;
        totalProvisiones: number;
        totalCosto: number;
      }
    >();

    const empleadosSet = new Set<string>();

    for (const l of liquidaciones) {
      const cc = (l as any).empleado?.centroCosto;
      const key = cc?.id || 'sin-asignar';
      if (!mapa.has(key)) {
        mapa.set(key, {
          centroCostoId: cc?.id || null,
          centroCostoCodigo: cc?.codigo || 'N/A',
          centroCostoNombre: cc?.nombre || 'Sin Centro de Costo',
          empleados: 0,
          totalDevengado: 0,
          totalAportes: 0,
          totalProvisiones: 0,
          totalCosto: 0,
        });
      }
      const g = mapa.get(key)!;
      g.totalDevengado += Number(l.totalDevengado);
      g.totalAportes += Number(l.totalAportes);
      g.totalProvisiones += Number(l.totalProvisiones);
      g.totalCosto +=
        Number(l.totalDevengado) +
        Number(l.totalAportes) +
        Number(l.totalProvisiones);
    }

    // Contar empleados únicos por centro de costo
    const empCountMap = new Map<string, Set<string>>();
    for (const l of liquidaciones) {
      const cc = (l as any).empleado?.centroCosto;
      const key = cc?.id || 'sin-asignar';
      if (!empCountMap.has(key)) empCountMap.set(key, new Set());
      empCountMap.get(key)!.add(l.empleadoId);
    }
    for (const [key, empSet] of empCountMap) {
      if (mapa.has(key)) mapa.get(key)!.empleados = empSet.size;
    }

    const data = Array.from(mapa.values()).map((g) => ({
      ...g,
      totalDevengado: Math.round(g.totalDevengado * 100) / 100,
      totalAportes: Math.round(g.totalAportes * 100) / 100,
      totalProvisiones: Math.round(g.totalProvisiones * 100) / 100,
      totalCosto: Math.round(g.totalCosto * 100) / 100,
    }));

    const totales = {
      empleados: data.reduce((s, r) => s + r.empleados, 0),
      totalDevengado: data.reduce((s, r) => s + r.totalDevengado, 0),
      totalAportes: data.reduce((s, r) => s + r.totalAportes, 0),
      totalProvisiones: data.reduce((s, r) => s + r.totalProvisiones, 0),
      totalCosto: data.reduce((s, r) => s + r.totalCosto, 0),
    };

    return { data, totales };
  }

  async reporteCostosPorCargo(fechaInicio?: string, fechaFin?: string) {
    const qb = this.liquidacionRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.empleado', 'e')
      .leftJoin('e.cargo', 'c')
      .addSelect(['c.id', 'c.codigo', 'c.nombre'])
      .leftJoin('l.periodo', 'p')
      .where('p.estado != :anulado', { anulado: EstadoPeriodoNomina.ANULADA });

    if (fechaInicio) qb.andWhere('p.fechaInicio >= :fi', { fi: fechaInicio });
    if (fechaFin) qb.andWhere('p.fechaFin <= :ff', { ff: fechaFin });

    const liquidaciones = await qb.getMany();

    const mapa = new Map<
      string,
      {
        cargoId: string;
        cargoCodigo: string;
        cargoNombre: string;
        empleados: number;
        totalDevengado: number;
        totalAportes: number;
        totalProvisiones: number;
        totalCosto: number;
      }
    >();

    const empCountMap = new Map<string, Set<string>>();

    for (const l of liquidaciones) {
      const cargo = (l as any).empleado?.cargo;
      const key = cargo?.id || 'sin-asignar';

      if (!mapa.has(key)) {
        mapa.set(key, {
          cargoId: cargo?.id || null,
          cargoCodigo: cargo?.codigo || 'N/A',
          cargoNombre: cargo?.nombre || 'Sin Cargo',
          empleados: 0,
          totalDevengado: 0,
          totalAportes: 0,
          totalProvisiones: 0,
          totalCosto: 0,
        });
      }
      if (!empCountMap.has(key)) empCountMap.set(key, new Set());
      empCountMap.get(key)!.add(l.empleadoId);

      const g = mapa.get(key)!;
      g.totalDevengado += Number(l.totalDevengado);
      g.totalAportes += Number(l.totalAportes);
      g.totalProvisiones += Number(l.totalProvisiones);
      g.totalCosto +=
        Number(l.totalDevengado) +
        Number(l.totalAportes) +
        Number(l.totalProvisiones);
    }

    for (const [key, empSet] of empCountMap) {
      if (mapa.has(key)) mapa.get(key)!.empleados = empSet.size;
    }

    const data = Array.from(mapa.values()).map((g) => ({
      ...g,
      totalDevengado: Math.round(g.totalDevengado * 100) / 100,
      totalAportes: Math.round(g.totalAportes * 100) / 100,
      totalProvisiones: Math.round(g.totalProvisiones * 100) / 100,
      totalCosto: Math.round(g.totalCosto * 100) / 100,
    }));

    const totales = {
      empleados: data.reduce((s, r) => s + r.empleados, 0),
      totalDevengado: data.reduce((s, r) => s + r.totalDevengado, 0),
      totalAportes: data.reduce((s, r) => s + r.totalAportes, 0),
      totalProvisiones: data.reduce((s, r) => s + r.totalProvisiones, 0),
      totalCosto: data.reduce((s, r) => s + r.totalCosto, 0),
    };

    return { data, totales };
  }

  async reporteComparativoPeriodos(periodo1Id: string, periodo2Id: string) {
    const [p1, p2] = await Promise.all([
      this.periodoRepo.findOne({ where: { id: periodo1Id } }),
      this.periodoRepo.findOne({ where: { id: periodo2Id } }),
    ]);

    if (!p1) throw new NotFoundException(`Período ${periodo1Id} no encontrado`);
    if (!p2) throw new NotFoundException(`Período ${periodo2Id} no encontrado`);

    const [liq1, liq2] = await Promise.all([
      this.liquidacionRepo.find({
        where: { periodoId: periodo1Id },
        relations: ['empleado'],
      }),
      this.liquidacionRepo.find({
        where: { periodoId: periodo2Id },
        relations: ['empleado'],
      }),
    ]);

    const sumar = (items: any[]) => ({
      empleados: items.length,
      totalDevengado:
        Math.round(
          items.reduce((s, l) => s + Number(l.totalDevengado), 0) * 100,
        ) / 100,
      totalDeducciones:
        Math.round(
          items.reduce((s, l) => s + Number(l.totalDeducciones), 0) * 100,
        ) / 100,
      totalNeto:
        Math.round(items.reduce((s, l) => s + Number(l.netoPagar), 0) * 100) /
        100,
      totalAportes:
        Math.round(
          items.reduce((s, l) => s + Number(l.totalAportes), 0) * 100,
        ) / 100,
      totalProvisiones:
        Math.round(
          items.reduce((s, l) => s + Number(l.totalProvisiones), 0) * 100,
        ) / 100,
      saludEmpleado:
        Math.round(
          items.reduce((s, l) => s + Number(l.saludEmpleado), 0) * 100,
        ) / 100,
      pensionEmpleado:
        Math.round(
          items.reduce((s, l) => s + Number(l.pensionEmpleado), 0) * 100,
        ) / 100,
      retencionFuente:
        Math.round(
          items.reduce((s, l) => s + Number(l.retencionFuente), 0) * 100,
        ) / 100,
      costoEmpresa:
        Math.round(
          items.reduce(
            (s, l) =>
              s +
              Number(l.totalDevengado) +
              Number(l.totalAportes) +
              Number(l.totalProvisiones),
            0,
          ) * 100,
        ) / 100,
    });

    const detalleEmpleados = liq1.map((l1) => {
      const l2 = liq2.find((l) => l.empleadoId === l1.empleadoId);
      const nombre =
        `${l1.empleado?.primerNombre || ''} ${l1.empleado?.primerApellido || ''}`.trim();
      return {
        empleadoId: l1.empleadoId,
        empleadoNombre: nombre,
        periodo1: {
          devengado: Number(l1.totalDevengado),
          deducciones: Number(l1.totalDeducciones),
          neto: Number(l1.netoPagar),
        },
        periodo2: l2
          ? {
              devengado: Number(l2.totalDevengado),
              deducciones: Number(l2.totalDeducciones),
              neto: Number(l2.netoPagar),
            }
          : null,
        variacion: l2
          ? Math.round(
              (((Number(l2.totalDevengado) - Number(l1.totalDevengado)) * 100) /
                (Number(l1.totalDevengado) || 1)) *
                100,
            ) / 100
          : null,
      };
    });

    return {
      periodo1: { ...p1, ...sumar(liq1) },
      periodo2: { ...p2, ...sumar(liq2) },
      detalleEmpleados,
    };
  }

  async reporteResumenAportes(periodoId: string) {
    const periodo = await this.periodoRepo.findOne({
      where: { id: periodoId },
    });
    if (!periodo)
      throw new NotFoundException(`Período ${periodoId} no encontrado`);

    const liquidaciones = await this.liquidacionRepo.find({
      where: { periodoId },
      relations: ['empleado'],
    });

    const aportesMap = new Map<
      string,
      { concepto: string; valor: number; empleados: Set<string> }
    >();

    for (const l of liquidaciones) {
      const aportes: { concepto: string; valor: number }[] =
        (l.aportesEmpleador as any) || [];
      for (const ap of aportes) {
        if (!aportesMap.has(ap.concepto)) {
          aportesMap.set(ap.concepto, {
            concepto: ap.concepto,
            valor: 0,
            empleados: new Set(),
          });
        }
        const g = aportesMap.get(ap.concepto)!;
        g.valor += Number(ap.valor);
        g.empleados.add(l.empleadoId);
      }
    }

    const data = Array.from(aportesMap.values()).map((g) => ({
      concepto: g.concepto,
      valor: Math.round(g.valor * 100) / 100,
      empleados: g.empleados.size,
    }));

    const totales = {
      totalAportes:
        Math.round(data.reduce((s, d) => s + d.valor, 0) * 100) / 100,
      totalEmpleados: liquidaciones.length,
      totalDevengado:
        Math.round(
          liquidaciones.reduce((s, l) => s + Number(l.totalDevengado), 0) * 100,
        ) / 100,
    };

    // Aportes por empleado
    const detalleEmpleados = liquidaciones.map((l) => {
      const nombre =
        `${l.empleado?.primerNombre || ''} ${l.empleado?.primerApellido || ''}`.trim();
      return {
        empleadoId: l.empleadoId,
        empleadoNombre: nombre,
        ibc: Number(l.ibc),
        aportes: ((l.aportesEmpleador as any[]) || []).map((ap) => ({
          concepto: ap.concepto,
          valor: Number(ap.valor),
        })),
        totalAportesEmpleado: Number(l.totalAportes),
      };
    });

    return {
      periodo: { id: periodo.id, nombre: periodo.nombre, tipo: periodo.tipo },
      resumen: data,
      totales,
      detalleEmpleados,
    };
  }
}
