import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';

import { Pago } from './entities/pago.entity';
import { TipoPago, MedioPago, PaymentStatus } from './enums/pago.enum';

import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';

import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { RegistrarCobroDto, RegistrarPagoDto } from './dto/create-pago.dto';
import { FormaPago, InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { MathUtil } from 'src/common/utils/math.util';
import { AsientoContable } from 'src/asientos-contables/entities/asientos-contable.entity';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,

    @InjectRepository(CuentasBancarias)
    private readonly cuentaBancariaRepository: Repository<CuentasBancarias>,

    @InjectRepository(FacturasVenta)
    private readonly facturaVentaRepository: Repository<FacturasVenta>,

    @InjectRepository(FacturaCompra)
    private readonly facturaCompraRepository: Repository<FacturaCompra>,

    private readonly dataSource: DataSource,
    private readonly asientosContablesService: AsientosContablesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // COBROS (Cuentas por Cobrar — ventas a crédito)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Registra un abono (cobro) sobre una factura de venta a crédito.
   *
   * Asiento generado:
   *   si medioPago = caja:
   *     DÉBITO:  Caja 1105        <monto>
   *     CRÉDITO: Clientes 1305   <monto>
   *   si medioPago = banco/transferencia/cheque:
   *     DÉBITO:  Bancos 1110      <monto>
   *     CRÉDITO: Clientes 1305   <monto>
   */
  async registrarCobro(
    facturaVentaId: string,
    dto: RegistrarCobroDto,
    userId: string,
  ): Promise<{ pago: Pago; factura: FacturasVenta }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 1. Obtener y validar la factura ──────────────────────────────
      const factura = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id: facturaVentaId },
        relations: ['client'],
      });

      if (!factura) {
        throw new NotFoundException(`Factura de venta ${facturaVentaId} no encontrada`);
      }

      if (factura.formaPago !== FormaPago.CREDITO) {
        throw new BadRequestException(
          'Solo se pueden registrar cobros en facturas a crédito',
        );
      }

      const estadosPermitidos: InvoiceStatus[] = [
        InvoiceStatus.ISSUED,
        InvoiceStatus.ACCEPTED,
      ];
      if (!estadosPermitidos.includes(factura.status)) {
        throw new BadRequestException(
          `No se puede cobrar una factura en estado: ${factura.status}`,
        );
      }

      if (factura.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('Esta factura ya está completamente pagada');
      }

      // ── 2. Validar monto ─────────────────────────────────────────────
      const montoMaximo = factura.saldoPendiente;
      if (dto.monto <= 0) {
        throw new BadRequestException('El monto debe ser mayor a 0');
      }
      if (dto.monto > montoMaximo) {
        throw new BadRequestException(
          `El monto $${dto.monto} supera el saldo pendiente de $${montoMaximo}`,
        );
      }

      // ── 3. Validar cuenta bancaria si aplica ─────────────────────────
      if (dto.medioPago !== MedioPago.CAJA && !dto.cuentaBancariaId) {
        throw new BadRequestException(
          'Debe especificar cuentaBancariaId cuando el medio de pago no es caja',
        );
      }

      let cuentaBancaria: CuentasBancarias | null = null;
      if (dto.cuentaBancariaId) {
        cuentaBancaria = await queryRunner.manager.findOne(CuentasBancarias, {
          where: { id: dto.cuentaBancariaId, activa: true },
        });
        if (!cuentaBancaria) {
          throw new NotFoundException(`Cuenta bancaria ${dto.cuentaBancariaId} no encontrada`);
        }
      }

      // ── 4. Calcular nuevo saldo ──────────────────────────────────────
      const nuevoTotalPagado    = MathUtil.sum(factura.totalPagado, dto.monto);
      const nuevoSaldoPendiente = MathUtil.sub(factura.total, nuevoTotalPagado);
      const nuevoPaymentStatus  = nuevoSaldoPendiente === 0
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      // ── 5. Generar asiento contable ──────────────────────────────────
      const cuentaDebitoCode = dto.medioPago === MedioPago.CAJA ? '1105' : '1110';

      let asientoId: string = '';
      try {
        const asiento = await this.asientosContablesService.generarAsientoCobro({
          facturaVenta: factura,
          monto: dto.monto,
          fecha: new Date(dto.fecha),
          cuentaDebitoCodigo: cuentaDebitoCode,
          userId,
        });
        asientoId = asiento.id;
        this.logger.log(`Asiento de cobro generado: ${asientoId}`);
      } catch (asientoError) {
        this.logger.error(`Error generando asiento de cobro: ${asientoError.message}`);
        // No se revierte la transacción por error de asiento — el pago se registra,
        // pero el asientoId quedará '' para revisión manual.
      }

      // ── 6. Crear registro de pago ────────────────────────────────────
      const pago = queryRunner.manager.create(Pago, {
        tipo:             TipoPago.COBRO,
        facturaVentaId:   factura.id,
        fecha:            new Date(dto.fecha),
        monto:            dto.monto,
        medioPago:        dto.medioPago,
        cuentaBancariaId: dto.cuentaBancariaId || null,
        referencia:       dto.referencia || null,
        notas:            dto.notas || null,
        asientoId,
        creadoPorId:      userId,
        createdAt:        new Date(),
      });

      const pagoGuardado = await queryRunner.manager.save(Pago, pago);

      // ── 7. Actualizar factura ────────────────────────────────────────
      await queryRunner.manager.update(FacturasVenta, { id: factura.id }, {
        totalPagado:    nuevoTotalPagado,
        saldoPendiente: nuevoSaldoPendiente,
        paymentStatus:  nuevoPaymentStatus,
      });

      // ── 8. Actualizar saldo de cuenta bancaria ─────────────────────
      if (dto.medioPago !== MedioPago.CAJA && dto.cuentaBancariaId) {
        const cta = await queryRunner.manager.findOne(CuentasBancarias, { where: { id: dto.cuentaBancariaId } });
        if (cta) {
          cta.saldoActual = MathUtil.sum(cta.saldoActual, dto.monto);
          await queryRunner.manager.save(CuentasBancarias, cta);
        }
      }

      await queryRunner.commitTransaction();

      const facturaActualizada = await this.facturaVentaRepository.findOne({
        where: { id: facturaVentaId },
        relations: ['client', 'pagos'],
      });

      if (!facturaActualizada) {
        throw new NotFoundException(`Factura de venta ${facturaVentaId} no encontrada`);
      }

      this.logger.log(
        `Cobro registrado: $${dto.monto} en factura ${factura.comprobante_completo} ` +
        `| Saldo restante: $${nuevoSaldoPendiente}`,
      );

      return { pago: pagoGuardado, factura: facturaActualizada };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error registrando cobro: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al registrar el cobro');
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PAGOS (Cuentas por Pagar — compras a crédito)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Registra un pago sobre una factura de compra a crédito.
   *
   * Asiento generado:
   *   DÉBITO:  Proveedores 2205  <monto>
   *   CRÉDITO: Bancos 1110       <monto>  (o Caja 1105 si pagaron en efectivo)
   */
  async registrarPago(
    facturaCompraId: string,
    dto: RegistrarPagoDto,
    userId: string,
  ): Promise<{ pago: Pago; factura: FacturaCompra }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 1. Obtener y validar ─────────────────────────────────────────
      const factura = await queryRunner.manager.findOne(FacturaCompra, {
        where: { id: facturaCompraId },
        relations: ['proveedor'],
      });

      if (!factura) {
        throw new NotFoundException(`Factura de compra ${facturaCompraId} no encontrada`);
      }

      if (factura.formaPago !== 'CREDITO') {
        throw new BadRequestException(
          'Solo se pueden registrar pagos en facturas de compra a crédito',
        );
      }

      if (factura.estado !== GastoEstado.REGISTRADO) {
        throw new BadRequestException(
          `No se puede pagar una factura de compra en estado: ${factura.estado}`,
        );
      }

      if (factura.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('Esta factura de compra ya está completamente pagada');
      }

      // ── 2. Validar monto ─────────────────────────────────────────────
      if (dto.monto <= 0) {
        throw new BadRequestException('El monto debe ser mayor a 0');
      }
      if (dto.monto > factura.saldoPendiente) {
        throw new BadRequestException(
          `El monto $${dto.monto} supera el saldo pendiente de $${factura.saldoPendiente}`,
        );
      }

      // ── 3. Validar cuenta bancaria si aplica ─────────────────────────
      if (dto.medioPago !== MedioPago.CAJA && !dto.cuentaBancariaId) {
        throw new BadRequestException(
          'Debe especificar cuentaBancariaId cuando el medio de pago no es caja',
        );
      }

      let cuentaBancaria: CuentasBancarias | null = null;
      if (dto.cuentaBancariaId) {
        cuentaBancaria = await queryRunner.manager.findOne(CuentasBancarias, {
          where: { id: dto.cuentaBancariaId, activa: true },
        });
        if (!cuentaBancaria) {
          throw new NotFoundException(`Cuenta bancaria ${dto.cuentaBancariaId} no encontrada`);
        }
      }

      // ── 4. Calcular nuevo saldo ──────────────────────────────────────
      const nuevoTotalPagado    = MathUtil.sum(factura.totalPagado, dto.monto);
      const nuevoSaldoPendiente = MathUtil.sub(factura.total, nuevoTotalPagado);
      const nuevoPaymentStatus  = nuevoSaldoPendiente === 0
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      // ── 5. Generar asiento contable ──────────────────────────────────
      const cuentaCreditoCodigo = dto.medioPago === MedioPago.CAJA ? '1105' : '1110';

      let asientoId: string = '';
      try {
        const asiento = await this.asientosContablesService.generarAsientoPagoCompra({
          facturaCompra: factura,
          monto: dto.monto,
          fecha: new Date(dto.fecha),
          cuentaCreditoCodigo,
          userId,
        });
        asientoId = asiento.id;
        this.logger.log(`Asiento de pago generado: ${asientoId}`);
      } catch (asientoError) {
        this.logger.error(`Error generando asiento de pago: ${asientoError.message}`);
        
      }

      // ── 6. Crear registro de pago ────────────────────────────────────
      const pago = queryRunner.manager.create(Pago, {
        tipo:             TipoPago.PAGO,
        facturaCompraId:  factura.id,
        fecha:            new Date(dto.fecha),
        monto:            dto.monto,
        medioPago:        dto.medioPago,
        cuentaBancariaId: dto.cuentaBancariaId || null,
        referencia:       dto.referencia || null,
        notas:            dto.notas || null,
        asientoId,
        creadoPorId:      userId,
        createdAt:        new Date(),
      });

      const pagoGuardado = await queryRunner.manager.save(Pago, pago);

      // ── 7. Actualizar factura compra ─────────────────────────────────
      const updatePayload: Partial<FacturaCompra> = {
        totalPagado:    nuevoTotalPagado,
        saldoPendiente: nuevoSaldoPendiente,
        paymentStatus:  nuevoPaymentStatus,
      };

      // Si quedó saldo 0, también actualizar el estado general de la compra
      // if (nuevoPaymentStatus === PaymentStatus.PAID) {
      //   updatePayload.estado = GastoEstado.PAGADO;
      // }

      await queryRunner.manager.update(FacturaCompra, { id: factura.id }, updatePayload);

      // ── 8. Actualizar saldo de cuenta bancaria ─────────────────────
      if (dto.medioPago !== MedioPago.CAJA && dto.cuentaBancariaId) {
        const cta = await queryRunner.manager.findOne(CuentasBancarias, { where: { id: dto.cuentaBancariaId } });
        if (cta) {
          cta.saldoActual = MathUtil.sub(cta.saldoActual, dto.monto);
          await queryRunner.manager.save(CuentasBancarias, cta);
        }
      }

      await queryRunner.commitTransaction();

      const facturaActualizada = await this.facturaCompraRepository.findOne({
        where: { id: facturaCompraId },
        relations: ['proveedor', 'pagos'],
      });

      if (!facturaActualizada) {
        throw new NotFoundException(`Factura de compra ${facturaCompraId} no encontrada`);
      }

      this.logger.log(
        `Pago registrado: $${dto.monto} en compra ${factura.numero} ` +
        `| Saldo restante: $${nuevoSaldoPendiente}`,
      );

      return { pago: pagoGuardado, factura: facturaActualizada };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error registrando pago: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al registrar el pago');
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORIAL
  // ═══════════════════════════════════════════════════════════════

  /** Historial de cobros de una factura de venta */
  async historialCobros(facturaVentaId: string): Promise<Pago[]> {
    return this.pagoRepository.find({
      where: { facturaVentaId, tipo: TipoPago.COBRO },
      relations: ['cuentaBancaria', 'creadoPor'],
      order: { fecha: 'ASC' },
    });
  }

  /** Historial de pagos de una factura de compra */
  async historialPagos(facturaCompraId: string): Promise<Pago[]> {
    return this.pagoRepository.find({
      where: { facturaCompraId, tipo: TipoPago.PAGO },
      relations: ['cuentaBancaria', 'creadoPor'],
      order: { fecha: 'ASC' },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // MOVIMIENTOS (listado global de cobros y pagos)
  // ═══════════════════════════════════════════════════════════════

  async listarMovimientos(filtros: {
    tipo?: TipoPago;
    fechaInicio?: string;
    fechaFin?: string;
    medioPago?: MedioPago;
    clienteId?: string;
    proveedorId?: string;
    busqueda?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.pagoRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.cuentaBancaria', 'cb')
      .leftJoinAndSelect('cb.banco', 'banco')
      .leftJoinAndSelect('p.creadoPor', 'user')
      .leftJoin('p.facturaVenta', 'fv')
      .leftJoin('fv.client', 'client')
      .leftJoin('p.facturaCompra', 'fc')
      .leftJoin('fc.proveedor', 'proveedor')
      .addSelect(['fv.id', 'fv.comprobante_completo', 'fv.comprobante', 'fv.clientId'])
      .addSelect(['client.id', 'client.razonSocial', 'client.nombre', 'client.apellido'])
      .addSelect(['fc.id', 'fc.numero', 'fc.proveedorId'])
      .addSelect(['proveedor.id', 'proveedor.razonSocial', 'proveedor.nombre', 'proveedor.apellido']);

    if (filtros.tipo) {
      qb.andWhere('p.tipo = :tipo', { tipo: filtros.tipo });
    }

    if (filtros.fechaInicio) {
      qb.andWhere('p.fecha >= :fechaInicio', { fechaInicio: filtros.fechaInicio });
    }

    if (filtros.fechaFin) {
      qb.andWhere('p.fecha <= :fechaFin', { fechaFin: filtros.fechaFin });
    }

    if (filtros.medioPago) {
      qb.andWhere('p.medioPago = :medioPago', { medioPago: filtros.medioPago });
    }

    if (filtros.clienteId) {
      qb.andWhere('fv.clientId = :clienteId', { clienteId: filtros.clienteId });
    }

    if (filtros.proveedorId) {
      qb.andWhere('fc.proveedorId = :proveedorId', { proveedorId: filtros.proveedorId });
    }

    if (filtros.busqueda) {
      qb.andWhere(
        '(LOWER(COALESCE(client.razonSocial, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(client.nombre, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(proveedor.razonSocial, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(proveedor.nombre, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(fv.comprobante_completo, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(fc.numero, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(p.referencia, \'\')) LIKE :b)',
        { b: `%${filtros.busqueda.toLowerCase()}%` },
      );
    }

    qb.orderBy('p.fecha', 'DESC').addOrderBy('p.createdAt', 'DESC');

    const [pagos, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const items = pagos.map(p => {
      const isCobro = p.tipo === TipoPago.COBRO;
      const factura = isCobro ? (p as any).facturaVenta : (p as any).facturaCompra;
      const tercero = isCobro ? factura?.client : factura?.proveedor;

      return {
        id: p.id,
        tipo: p.tipo,
        fecha: p.fecha,
        monto: p.monto,
        medioPago: p.medioPago,
        referencia: p.referencia,
        notas: p.notas,
        asientoId: p.asientoId,
        numeroFactura: isCobro
          ? (factura?.comprobante_completo || '—')
          : (factura?.numero || '—'),
        facturaId: isCobro ? p.facturaVentaId : p.facturaCompraId,
        contraparteId: tercero?.id || null,
        contraparteNombre: tercero
          ? (tercero.razonSocial || `${tercero.nombre} ${tercero.apellido}`)
          : '—',
        cuentaBancaria: p.cuentaBancaria
          ? {
              id: p.cuentaBancaria.id,
              nombre: p.cuentaBancaria.nombre,
              numeroCuenta: p.cuentaBancaria.numeroCuenta,
              banco: p.cuentaBancaria.banco
                ? { id: p.cuentaBancaria.banco.id, nombre: p.cuentaBancaria.banco.nombre }
                : null,
            }
          : null,
        creadoPor: p.creadoPor
          ? `${(p.creadoPor as any).nombre || ''} ${(p.creadoPor as any).apellido || ''}`.trim()
          : '—',
        createdAt: p.createdAt,
      };
    });

    const totalCobros = items.filter(i => i.tipo === TipoPago.COBRO).reduce((s, i) => s + Number(i.monto), 0);
    const totalPagos = items.filter(i => i.tipo === TipoPago.PAGO).reduce((s, i) => s + Number(i.monto), 0);

    return {
      items,
      resumen: { totalCobros, totalPagos, neto: totalCobros - totalPagos },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ASIENTO CONTABLE DE UN PAGO
  // ═══════════════════════════════════════════════════════════════

  async obtenerAsientoDePago(pagoId: string) {
    const pago = await this.pagoRepository.findOne({
      where: { id: pagoId },
      relations: ['facturaVenta', 'facturaCompra', 'cuentaBancaria'],
    });

    if (!pago) {
      throw new NotFoundException(`Pago ${pagoId} no encontrado`);
    }

    if (!pago.asientoId) {
      return { pago, asiento: null, detalles: [] };
    }

    const asiento = await this.dataSource.getRepository(AsientoContable).findOne({
      where: { id: pago.asientoId },
      relations: ['detalles', 'detalles.cuenta'],
    });

    return {
      pago: {
        id: pago.id,
        tipo: pago.tipo,
        fecha: pago.fecha,
        monto: pago.monto,
        medioPago: pago.medioPago,
        referencia: pago.referencia,
        numeroFactura: pago.facturaVenta
          ? pago.facturaVenta.comprobante_completo
          : (pago.facturaCompra?.numero || '—'),
      },
      asiento: asiento
        ? {
            id: asiento.id,
            numero: asiento.numero,
            fecha: asiento.fecha,
            tipo: asiento.tipo,
            referencia: asiento.referencia,
            descripcion: asiento.descripcion,
            totalDebito: asiento.totalDebito,
            totalCredito: asiento.totalCredito,
          }
        : null,
      detalles: asiento?.detalles?.map(d => ({
        id: d.id,
        cuentaCodigo: d.cuenta?.codigo || '—',
        cuentaNombre: d.cuenta?.nombre || '—',
        debito: d.debito,
        credito: d.credito,
        descripcion: d.descripcion,
      })) || [],
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // RESUMEN FINANCIERO (Dashboard unificado)
  // ═══════════════════════════════════════════════════════════════

  async obtenerResumenFinanciero() {
    // CxC: Total por cobrar, vencido, por vencer
    const cxcResult = await this.facturaVentaRepository
      .createQueryBuilder('fv')
      .select('SUM(fv.saldoPendiente)', 'totalPendiente')
      .addSelect('COUNT(fv.id)', 'totalFacturas')
      .addSelect('SUM(CASE WHEN fv.fechaVencimiento < CURRENT_DATE THEN fv.saldoPendiente ELSE 0 END)', 'totalVencido')
      .addSelect('SUM(CASE WHEN fv.fechaVencimiento >= CURRENT_DATE THEN fv.saldoPendiente ELSE 0 END)', 'totalPorVencer')
      .where('fv.formaPago = :formaPago', { formaPago: FormaPago.CREDITO })
      .andWhere('fv.paymentStatus IN (:...estados)', { estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE] })
      .andWhere('fv.saldoPendiente > 0')
      .andWhere('fv.status NOT IN (:...excluidos)', { excluidos: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] })
      .getRawOne();

    // CxP: Total por pagar, vencido, por vencer
    const cxpResult = await this.facturaCompraRepository
      .createQueryBuilder('fc')
      .select('SUM(fc.saldoPendiente)', 'totalPendiente')
      .addSelect('COUNT(fc.id)', 'totalFacturas')
      .addSelect('SUM(CASE WHEN fc.fechaVencimiento < CURRENT_DATE THEN fc.saldoPendiente ELSE 0 END)', 'totalVencido')
      .addSelect('SUM(CASE WHEN fc.fechaVencimiento >= CURRENT_DATE THEN fc.saldoPendiente ELSE 0 END)', 'totalPorVencer')
      .where('fc.formaPago = :formaPago', { formaPago: 'CREDITO' })
      .andWhere('fc.paymentStatus IN (:...estados)', { estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE] })
      .andWhere('fc.saldoPendiente > 0')
      .andWhere('fc.estado NOT IN (:...excluidos)', { excluidos: [GastoEstado.ANULADO, GastoEstado.BORRADOR] })
      .getRawOne();

    // Últimos movimientos (últimos 10)
    const ultimosMovimientos = await this.pagoRepository
      .createQueryBuilder('p')
      .leftJoin('p.facturaVenta', 'fv')
      .leftJoin('fv.client', 'client')
      .leftJoin('p.facturaCompra', 'fc')
      .leftJoin('fc.proveedor', 'proveedor')
      .addSelect(['fv.comprobante_completo', 'client.razonSocial', 'client.nombre', 'client.apellido'])
      .addSelect(['fc.numero', 'proveedor.razonSocial', 'proveedor.nombre', 'proveedor.apellido'])
      .orderBy('p.fecha', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .limit(10)
      .getMany();

    const movimientos = ultimosMovimientos.map(p => {
      const isCobro = p.tipo === TipoPago.COBRO;
      const factura = isCobro ? (p as any).facturaVenta : (p as any).facturaCompra;
      const tercero = isCobro ? factura?.client : factura?.proveedor;

      return {
        id: p.id,
        tipo: p.tipo,
        fecha: p.fecha,
        monto: p.monto,
        numeroFactura: isCobro ? (factura?.comprobante_completo || '—') : (factura?.numero || '—'),
        contraparteNombre: tercero ? (tercero.razonSocial || `${tercero.nombre} ${tercero.apellido}`) : '—',
      };
    });

    // Próximos vencimientos (próximos 7 días)
    const proximosVencimientos = await this.facturaVentaRepository
      .createQueryBuilder('fv')
      .leftJoinAndSelect('fv.client', 'client')
      .where('fv.formaPago = :formaPago', { formaPago: FormaPago.CREDITO })
      .andWhere('fv.paymentStatus IN (:...estados)', { estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] })
      .andWhere('fv.saldoPendiente > 0')
      .andWhere('fv.fechaVencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL \'7 days\'')
      .andWhere('fv.status NOT IN (:...excluidos)', { excluidos: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] })
      .orderBy('fv.fechaVencimiento', 'ASC')
      .limit(5)
      .getMany();

    const vencimientos = proximosVencimientos.map(f => ({
      facturaId: f.id,
      numeroFactura: f.comprobante_completo,
      clienteNombre: f.client.razonSocial || `${f.client.nombre} ${f.client.apellido}`,
      saldoPendiente: f.saldoPendiente,
      fechaVencimiento: f.fechaVencimiento,
    }));

    return {
      cxc: {
        totalPendiente: Number(cxcResult?.totalPendiente || 0),
        totalVencido: Number(cxcResult?.totalVencido || 0),
        totalPorVencer: Number(cxcResult?.totalPorVencer || 0),
        totalFacturas: Number(cxcResult?.totalFacturas || 0),
      },
      cxp: {
        totalPendiente: Number(cxpResult?.totalPendiente || 0),
        totalVencido: Number(cxpResult?.totalVencido || 0),
        totalPorVencer: Number(cxpResult?.totalPorVencer || 0),
        totalFacturas: Number(cxpResult?.totalFacturas || 0),
      },
      posicionNeta: Number(cxcResult?.totalPendiente || 0) - Number(cxpResult?.totalPendiente || 0),
      ultimosMovimientos: movimientos,
      proximosVencimientos: vencimientos,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ESTADO DE CUENTA POR CLIENTE
  // ═══════════════════════════════════════════════════════════════

  async obtenerEstadoCuentaCliente(clienteId: string) {
    // Facturas pendientes
    const facturasPendientes = await this.facturaVentaRepository
      .createQueryBuilder('fv')
      .where('fv.clientId = :clienteId', { clienteId })
      .andWhere('fv.formaPago = :formaPago', { formaPago: FormaPago.CREDITO })
      .andWhere('fv.paymentStatus IN (:...estados)', { estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE] })
      .andWhere('fv.saldoPendiente > 0')
      .andWhere('fv.status NOT IN (:...excluidos)', { excluidos: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] })
      .orderBy('fv.fechaVencimiento', 'ASC')
      .getMany();

    // Historial de cobros
    const cobros = await this.pagoRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.facturaVenta', 'fv')
      .leftJoinAndSelect('p.cuentaBancaria', 'cb')
      .leftJoinAndSelect('cb.banco', 'banco')
      .where('fv.clientId = :clienteId', { clienteId })
      .andWhere('p.tipo = :tipo', { tipo: TipoPago.COBRO })
      .orderBy('p.fecha', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .getMany();

    const facturas = facturasPendientes.map(f => ({
      facturaId: f.id,
      numeroFactura: f.comprobante_completo,
      fecha: f.fecha,
      fechaVencimiento: f.fechaVencimiento,
      total: f.total,
      totalPagado: f.totalPagado,
      saldoPendiente: f.saldoPendiente,
      paymentStatus: f.paymentStatus,
    }));

    const movimientos = cobros.map(p => ({
      id: p.id,
      fecha: p.fecha,
      monto: p.monto,
      medioPago: p.medioPago,
      numeroFactura: p.facturaVenta?.comprobante_completo || '—',
      referencia: p.referencia,
      cuentaBancaria: p.cuentaBancaria
        ? { nombre: p.cuentaBancaria.nombre, banco: p.cuentaBancaria.banco?.nombre }
        : null,
    }));

    const totalFacturado = facturas.reduce((sum, f) => sum + Number(f.total), 0);
    const totalPagado = facturas.reduce((sum, f) => sum + Number(f.totalPagado), 0);
    const saldoPendiente = facturas.reduce((sum, f) => sum + Number(f.saldoPendiente), 0);

    return {
      clienteId,
      resumen: {
        totalFacturado,
        totalPagado,
        saldoPendiente,
        totalFacturas: facturas.length,
        totalCobros: movimientos.length,
      },
      facturas,
      movimientos,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ESTADO DE CUENTA POR PROVEEDOR
  // ═══════════════════════════════════════════════════════════════

  async obtenerEstadoCuentaProveedor(proveedorId: string) {
    // Facturas pendientes
    const facturasPendientes = await this.facturaCompraRepository
      .createQueryBuilder('fc')
      .where('fc.proveedorId = :proveedorId', { proveedorId })
      .andWhere('fc.formaPago = :formaPago', { formaPago: 'CREDITO' })
      .andWhere('fc.paymentStatus IN (:...estados)', { estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE] })
      .andWhere('fc.saldoPendiente > 0')
      .andWhere('fc.estado NOT IN (:...excluidos)', { excluidos: [GastoEstado.ANULADO, GastoEstado.BORRADOR] })
      .orderBy('fc.fechaVencimiento', 'ASC')
      .getMany();

    // Historial de pagos
    const pagos = await this.pagoRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.facturaCompra', 'fc')
      .leftJoinAndSelect('p.cuentaBancaria', 'cb')
      .leftJoinAndSelect('cb.banco', 'banco')
      .where('fc.proveedorId = :proveedorId', { proveedorId })
      .andWhere('p.tipo = :tipo', { tipo: TipoPago.PAGO })
      .orderBy('p.fecha', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .getMany();

    const facturas = facturasPendientes.map(f => ({
      facturaId: f.id,
      numeroFactura: f.numero,
      fecha: f.fecha,
      fechaVencimiento: f.fechaVencimiento,
      total: f.total,
      totalPagado: f.totalPagado,
      saldoPendiente: f.saldoPendiente,
      paymentStatus: f.paymentStatus,
    }));

    const movimientos = pagos.map(p => ({
      id: p.id,
      fecha: p.fecha,
      monto: p.monto,
      medioPago: p.medioPago,
      numeroFactura: p.facturaCompra?.numero || '—',
      referencia: p.referencia,
      cuentaBancaria: p.cuentaBancaria
        ? { nombre: p.cuentaBancaria.nombre, banco: p.cuentaBancaria.banco?.nombre }
        : null,
    }));

    const totalFacturado = facturas.reduce((sum, f) => sum + Number(f.total), 0);
    const totalPagado = facturas.reduce((sum, f) => sum + Number(f.totalPagado), 0);
    const saldoPendiente = facturas.reduce((sum, f) => sum + Number(f.saldoPendiente), 0);

    return {
      proveedorId,
      resumen: {
        totalFacturado,
        totalPagado,
        saldoPendiente,
        totalFacturas: facturas.length,
        totalPagos: movimientos.length,
      },
      facturas,
      movimientos,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CUENTAS BANCARIAS
  // ═══════════════════════════════════════════════════════════════

  async findCuentasBancarias(): Promise<CuentasBancarias[]> {
    return this.cuentaBancariaRepository.find({
      where: { activa: true },
      order: { nombre: 'ASC' },
    });
  }
}