import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository, QueryRunner, In } from 'typeorm';

import { Pago } from './entities/pago.entity';
import { TipoPago, MedioPago, PaymentStatus, AnticipoTipo, AnticipoEstado, EstadoPago } from './enums/pago.enum';
import { PagoFacturaDetalle } from './entities/pago-factura-detalle.entity';
import { PagoConceptoDetalle } from './entities/pago-concepto-detalle.entity';
import { RegistrarPagoMultipleDto, RegistrarOtrosConceptosDto } from './dto/registrar-pago-multiple.dto';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { MetodoPago } from 'src/core/catalogs/entities/metodo-pago.entity';

import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';

import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { RegistrarCobroDto, RegistrarPagoDto } from './dto/create-pago.dto';
import { FormaPago, InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { MathUtil } from 'src/common/utils/math.util';
import { AsientoContable, TipoAsiento } from 'src/asientos-contables/entities/asientos-contable.entity';
import { Anticipo } from './entities/anticipo.entity';
import { AnticipoAplicacion, AplicacionEstado } from './entities/anticipo-aplicacion.entity';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  private getMedioPagoFromCodigo(codigo: string): MedioPago {
    // 10: Efectivo (caja)
    // 47: Transferencia bancaria (banco)
    // 42: Consignacion bancaria (banco)
    // 20: Cheque (cheque)
    if (codigo === '47' || codigo === '42' || codigo === '30' || codigo === '48' || codigo === '49') {
      return MedioPago.BANCO;
    }
    if (codigo === '20') {
      return MedioPago.CHEQUE;
    }
    return MedioPago.CAJA;
  }

  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,

    @InjectRepository(PagoFacturaDetalle)
    private readonly pagoFacturaDetalleRepository: Repository<PagoFacturaDetalle>,

    @InjectRepository(PagoConceptoDetalle)
    private readonly pagoConceptoDetalleRepository: Repository<PagoConceptoDetalle>,

    @InjectRepository(CuentasBancarias)
    private readonly cuentaBancariaRepository: Repository<CuentasBancarias>,

    @InjectRepository(FacturasVenta)
    private readonly facturaVentaRepository: Repository<FacturasVenta>,

    @InjectRepository(FacturaCompra)
    private readonly facturaCompraRepository: Repository<FacturaCompra>,

    @InjectRepository(Anticipo)
    private readonly anticipoRepository: Repository<Anticipo>,

    @InjectRepository(AnticipoAplicacion)
    private readonly anticipoAplicacionRepository: Repository<AnticipoAplicacion>,

    private readonly dataSource: DataSource,
    private readonly asientosContablesService: AsientosContablesService,
  ) { }

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
    qr?: QueryRunner,
  ): Promise<{ pago: Pago; factura: FacturasVenta }> {
    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      // ── 1. Obtener y validar la factura ──────────────────────────────
      const factura = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id: facturaVentaId },
        relations: ['client'],
      });

      if (!factura) {
        throw new NotFoundException(`Factura de venta ${facturaVentaId} no encontrada`);
      }

      if (factura.formaPago !== FormaPago.CREDITO && !isCustomRunner) {
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
      let medioPago = dto.medioPago;
      let metodoPagoRel: MetodoPago | null = null;
      if (dto.metodoPagoId) {
        metodoPagoRel = await queryRunner.manager.findOne(MetodoPago, {
          where: { id: dto.metodoPagoId },
        });
        if (!metodoPagoRel) {
          throw new NotFoundException(`Método de pago con ID ${dto.metodoPagoId} no encontrado`);
        }
        medioPago = this.getMedioPagoFromCodigo(metodoPagoRel.codigo);
      }

      if (medioPago !== MedioPago.CAJA && !dto.cuentaBancariaId) {
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
      const nuevoTotalPagado = MathUtil.sum(factura.totalPagado, dto.monto);
      const nuevoSaldoPendiente = MathUtil.sub(factura.total, nuevoTotalPagado);
      const nuevoPaymentStatus = nuevoSaldoPendiente === 0
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      // ── 5. Generar asiento contable ──────────────────────────────────
      const cuentaDebitoCode = medioPago === MedioPago.CAJA ? '1105' : '1110';

      let asientoId: string = '';
      try {
        const asiento = await this.asientosContablesService.generarAsientoCobro(
          {
            facturaVenta: factura,
            monto: dto.monto,
            fecha: new Date(dto.fecha),
            cuentaDebitoCodigo: cuentaDebitoCode,
            cuentaBancariaId: dto.cuentaBancariaId,
            medioPago: medioPago,
            userId,
          },
          queryRunner,
        );
        asientoId = asiento.id;
        this.logger.log(`Asiento de cobro generado: ${asientoId}`);
      } catch (asientoError) {
        this.logger.error(`Error generando asiento de cobro: ${asientoError.message}`);
        // No se revierte la transacción por error de asiento — el pago se registra,
        // pero el asientoId quedará '' para revisión manual.
      }

      // ── 6. Generar número de comprobante ─────────────────────────────
      const numeroComprobante = await this.generarNumeroPago(queryRunner, TipoPago.COBRO);

      // ── 7. Crear registro de pago ────────────────────────────────────
      const pago = queryRunner.manager.create(Pago, {
        numero: numeroComprobante,
        tipo: TipoPago.COBRO,
        facturaVentaId: factura.id,
        fecha: new Date(dto.fecha),
        monto: dto.monto,
        medioPago: medioPago,
        metodoPagoId: metodoPagoRel?.id || null,
        cuentaBancariaId: dto.cuentaBancariaId || null,
        referencia: dto.referencia || null,
        notas: dto.notas || null,
        asientoId,
        creadoPorId: userId,
        createdAt: new Date(),
      });

      const pagoGuardado = await queryRunner.manager.save(Pago, pago);

      // ── 8. Actualizar factura ─────────────────────────────────────
      await queryRunner.manager.update(FacturasVenta, { id: factura.id }, {
        totalPagado: nuevoTotalPagado,
        saldoPendiente: nuevoSaldoPendiente,
        paymentStatus: nuevoPaymentStatus,
      });

      // ── 9. Actualizar saldo de cuenta bancaria ─────────────────────
      if (dto.cuentaBancariaId) {
        const cta = await queryRunner.manager.findOne(CuentasBancarias, { where: { id: dto.cuentaBancariaId } });
        if (cta) {
          cta.saldoActual = MathUtil.sum(cta.saldoActual, dto.monto);
          await queryRunner.manager.save(CuentasBancarias, cta);
        }
      }

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }

      const facturaActualizada = await queryRunner.manager.findOne(FacturasVenta, {
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
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error registrando cobro: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al registrar el cobro');
    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
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
    qr?: QueryRunner,
  ): Promise<{ pago: Pago; factura: FacturaCompra }> {
    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      // ── 1. Obtener y validar ─────────────────────────────────────────
      const factura = await queryRunner.manager.findOne(FacturaCompra, {
        where: { id: facturaCompraId },
        relations: ['proveedor'],
      });

      if (!factura) {
        throw new NotFoundException(`Factura de compra ${facturaCompraId} no encontrada`);
      }

      if (factura.formaPago !== 'CREDITO' && !isCustomRunner) {
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
      let medioPago = dto.medioPago;
      let metodoPagoRel: MetodoPago | null = null;
      if (dto.metodoPagoId) {
        metodoPagoRel = await queryRunner.manager.findOne(MetodoPago, {
          where: { id: dto.metodoPagoId },
        });
        if (!metodoPagoRel) {
          throw new NotFoundException(`Método de pago con ID ${dto.metodoPagoId} no encontrado`);
        }
        medioPago = this.getMedioPagoFromCodigo(metodoPagoRel.codigo);
      }

      if (medioPago !== MedioPago.CAJA && !dto.cuentaBancariaId) {
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
      const nuevoTotalPagado = MathUtil.sum(factura.totalPagado, dto.monto);
      const nuevoSaldoPendiente = MathUtil.sub(factura.total, nuevoTotalPagado);
      const nuevoPaymentStatus = nuevoSaldoPendiente === 0
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIAL;

      // ── 5. Generar asiento contable ──────────────────────────────────
      const cuentaCreditoCodigo = medioPago === MedioPago.CAJA ? '1105' : '1110';

      let asientoId: string = '';
      try {
        const asiento = await this.asientosContablesService.generarAsientoPagoCompra(
          {
            facturaCompra: factura,
            monto: dto.monto,
            fecha: new Date(dto.fecha),
            cuentaCreditoCodigo,
            cuentaBancariaId: dto.cuentaBancariaId,
            medioPago: medioPago,
            userId,
          },
          queryRunner,
        );
        asientoId = asiento.id;
        this.logger.log(`Asiento de pago generado: ${asientoId}`);
      } catch (asientoError) {
        this.logger.error(`Error generando asiento de pago: ${asientoError.message}`);
      }

      // ── 6. Generar número de comprobante ─────────────────────────────
      const numeroComprobante = await this.generarNumeroPago(queryRunner, TipoPago.PAGO);

      // ── 7. Crear registro de pago ────────────────────────────────────
      const pago = queryRunner.manager.create(Pago, {
        numero: numeroComprobante,
        tipo: TipoPago.PAGO,
        facturaCompraId: factura.id,
        fecha: new Date(dto.fecha),
        monto: dto.monto,
        medioPago: medioPago,
        metodoPagoId: metodoPagoRel?.id || null,
        cuentaBancariaId: dto.cuentaBancariaId || null,
        referencia: dto.referencia || null,
        notas: dto.notas || null,
        asientoId,
        creadoPorId: userId,
        createdAt: new Date(),
      });

      const pagoGuardado = await queryRunner.manager.save(Pago, pago);

      // ── 8. Actualizar factura compra ─────────────────────────────────
      const updatePayload: Partial<FacturaCompra> = {
        totalPagado: nuevoTotalPagado,
        saldoPendiente: nuevoSaldoPendiente,
        paymentStatus: nuevoPaymentStatus,
      };

      await queryRunner.manager.update(FacturaCompra, { id: factura.id }, updatePayload);

      // ── 9. Actualizar saldo de cuenta bancaria ─────────────────────
      if (dto.cuentaBancariaId) {
        const cta = await queryRunner.manager.findOne(CuentasBancarias, { where: { id: dto.cuentaBancariaId } });
        if (cta) {
          cta.saldoActual = MathUtil.sub(cta.saldoActual, dto.monto);
          await queryRunner.manager.save(CuentasBancarias, cta);
        }
      }

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }

      const facturaActualizada = await queryRunner.manager.findOne(FacturaCompra, {
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
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error registrando pago: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al registrar el pago');
    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
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
    tipo?: string | string[];
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
      .leftJoinAndSelect('p.cliente', 'p_cliente')
      .leftJoinAndSelect('p.proveedor', 'p_proveedor')
      .leftJoinAndSelect('p.conceptosDetalles', 'pcd')
      .leftJoin('p.facturaVenta', 'fv')
      .leftJoin('fv.client', 'client')
      .leftJoin('p.facturaCompra', 'fc')
      .leftJoin('fc.proveedor', 'proveedor')
      .addSelect(['fv.id', 'fv.comprobante_completo', 'fv.comprobante', 'fv.clientId'])
      .addSelect(['client.id', 'client.razonSocial', 'client.nombre', 'client.apellido'])
      .addSelect(['fc.id', 'fc.numero', 'fc.proveedorId'])
      .addSelect(['proveedor.id', 'proveedor.razonSocial', 'proveedor.nombre', 'proveedor.apellido']);

    if (filtros.tipo) {
      let tipos: string[] = [];
      if (Array.isArray(filtros.tipo)) {
        tipos = filtros.tipo;
      } else if (typeof filtros.tipo === 'string') {
        tipos = filtros.tipo.split(',').map(t => t.trim());
      }

      if (tipos.length > 0) {
        qb.andWhere('p.tipo IN (:...tipos)', { tipos });
      }
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
      qb.andWhere('(fv.clientId = :clienteId OR p.clienteId = :clienteId)', { clienteId: filtros.clienteId });
    }

    if (filtros.proveedorId) {
      qb.andWhere('(fc.proveedorId = :proveedorId OR p.proveedorId = :proveedorId)', { proveedorId: filtros.proveedorId });
    }

    if (filtros.busqueda) {
      qb.andWhere(
        '(LOWER(COALESCE(client.razonSocial, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(client.nombre, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(p_cliente.razonSocial, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(p_cliente.nombre, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(proveedor.razonSocial, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(proveedor.nombre, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(p_proveedor.razonSocial, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(p_proveedor.nombre, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(fv.comprobante_completo, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(fc.numero, \'\')) LIKE :b ' +
        'OR LOWER(COALESCE(p.referencia, \'\')) LIKE :b)',
        { b: `%${filtros.busqueda.toLowerCase()}%` },
      );
    }

    qb.orderBy('p.fecha', 'DESC').addOrderBy('p.createdAt', 'DESC');

    const [pagos, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const items = pagos.map(p => {
      const esIngreso = p.tipo === TipoPago.COBRO || p.tipo === TipoPago.OTRO_INGRESO;
      const factura = esIngreso ? p.facturaVenta : p.facturaCompra;
      const tercero = p.cliente || p.proveedor || (esIngreso ? p.facturaVenta?.client : p.facturaCompra?.proveedor);

      let numeroFactura = '—';
      if (p.tipo === TipoPago.COBRO || p.tipo === TipoPago.PAGO) {
        if (esIngreso) {
          const fv = factura as FacturasVenta;
          numeroFactura = fv?.comprobante_completo || 'Múltiples';
        } else {
          const fc = factura as FacturaCompra;
          numeroFactura = fc?.numero || 'Múltiples';
        }
      } else if (p.tipo === TipoPago.OTRO_INGRESO || p.tipo === TipoPago.OTRO_EGRESO) {
        if (p.conceptosDetalles && p.conceptosDetalles.length > 0) {
          numeroFactura = p.conceptosDetalles.map(c => c.concepto).join(', ');
        }
      }

      return {
        id: p.id,
        numero: p.numero,
        tipo: p.tipo,
        fecha: p.fecha,
        monto: p.monto,
        medioPago: p.medioPago,
        referencia: p.referencia,
        notas: p.notas,
        asientoId: p.asientoId,
        numeroFactura,
        estado: p.estado,
        motivoAnulacion: p.motivoAnulacion,
        facturaId: esIngreso ? p.facturaVentaId : p.facturaCompraId,
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

    const totalCobros = items.filter(i => i.tipo === TipoPago.COBRO || i.tipo === TipoPago.OTRO_INGRESO).reduce((s, i) => s + Number(i.monto), 0);
    const totalPagos = items.filter(i => i.tipo === TipoPago.PAGO || i.tipo === TipoPago.OTRO_EGRESO).reduce((s, i) => s + Number(i.monto), 0);

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
      relations: [
        'facturaVenta',
        'facturaCompra',
        'cuentaBancaria',
        'facturasDetalles',
        'facturasDetalles.facturaVenta',
        'facturasDetalles.facturaCompra'
      ],
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

    let numeroFactura = '—';
    const esIngreso = pago.tipo === TipoPago.COBRO || pago.tipo === TipoPago.OTRO_INGRESO;
    if (pago.tipo === TipoPago.COBRO || pago.tipo === TipoPago.PAGO) {
      if (pago.facturasDetalles && pago.facturasDetalles.length > 1) {
        numeroFactura = 'Múltiples';
      } else if (pago.facturasDetalles && pago.facturasDetalles.length === 1) {
        const det = pago.facturasDetalles[0];
        numeroFactura = esIngreso
          ? (det.facturaVenta?.comprobante_completo || '—')
          : (det.facturaCompra?.numero || '—');
      } else {
        numeroFactura = pago.facturaVenta
          ? pago.facturaVenta.comprobante_completo
          : (pago.facturaCompra?.numero || '—');
      }
    }

    return {
      pago: {
        id: pago.id,
        numero: pago.numero,
        tipo: pago.tipo,
        fecha: pago.fecha,
        monto: pago.monto,
        medioPago: pago.medioPago,
        referencia: pago.referencia,
        numeroFactura,
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
        numero: p.numero,
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
  // ESTADO DE CUENTA POR NÚMERO DE DOCUMENTO
  // ═══════════════════════════════════════════════════════════════

  async obtenerEstadoCuentaClientePorDocumento(numeroDocumento: string) {
    const cliente = await this.dataSource
      .getRepository('clientes')
      .findOne({ where: { numeroDocumento } });

    if (!cliente) {
      throw new NotFoundException(`Cliente con documento ${numeroDocumento} no encontrado`);
    }

    return this.obtenerEstadoCuentaCliente(cliente.id);
  }

  async obtenerEstadoCuentaProveedorPorDocumento(identificacion: string) {
    const proveedor = await this.dataSource
      .getRepository('proveedores')
      .findOne({ where: { identificacion } });

    if (!proveedor) {
      throw new NotFoundException(`Proveedor con documento ${identificacion} no encontrado`);
    }

    return this.obtenerEstadoCuentaProveedor(proveedor.id);
  }

  // ═══════════════════════════════════════════════════════════════
  // GENERACIÓN DE NÚMERO DE COMPROBANTE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Genera un número secuencial para el comprobante de pago/cobro.
   * Formato: RC-0001 / CE-0001 (secuencia independiente por tipo).
   */
  private async generarNumeroPago(
    queryRunner: any,
    tipo: TipoPago,
  ): Promise<string> {
    const esIngreso = tipo === TipoPago.COBRO || (tipo as any) === 'otro_ingreso';
    const prefijo = esIngreso ? 'RC' : 'CE';

    // Buscar el último pago que empiece con el prefijo correspondiente
    const ultimoPago = await queryRunner.manager
      .createQueryBuilder(Pago, 'p')
      .where('p.numero LIKE :prefix', { prefix: `${prefijo}-%` })
      .orWhere('p.numero LIKE :legacyPrefix', { legacyPrefix: esIngreso ? 'COB-%' : 'PAG-%' })
      .orderBy('p.createdAt', 'DESC')
      .getOne();

    let correlativo = 1;
    if (ultimoPago?.numero) {
      const partes = ultimoPago.numero.split('-');
      const ultimoNum = parseInt(partes[1], 10);
      correlativo = isNaN(ultimoNum) ? 1 : ultimoNum + 1;
    }

    return `${prefijo}-${String(correlativo).padStart(4, '0')}`;
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

  // ═══════════════════════════════════════════════════════════════
  // NUEVOS FLUJOS FLEXIBLES: COBROS/PAGOS MÚLTIPLES Y OTROS MOVIMIENTOS
  // ═══════════════════════════════════════════════════════════════

  async obtenerFacturasPendientesCliente(clienteId: string) {
    return this.facturaVentaRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.client', 'client')
      .where('f.formaPago = :formaPago', { formaPago: FormaPago.CREDITO })
      .andWhere('f.paymentStatus IN (:...estados)', {
        estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
      })
      .andWhere('f.saldoPendiente > 0')
      .andWhere('f.status NOT IN (:...excluidos)', {
        excluidos: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
      })
      .andWhere('f.clientId = :clienteId', { clienteId })
      .orderBy('f.fechaVencimiento', 'ASC')
      .getMany();
  }

  async obtenerFacturasPendientesProveedor(proveedorId: string) {
    return this.facturaCompraRepository
      .createQueryBuilder('fc')
      .leftJoinAndSelect('fc.proveedor', 'proveedor')
      .where('fc.proveedorId = :proveedorId', { proveedorId })
      .andWhere('fc.formaPago = :formaPago', { formaPago: 'CREDITO' })
      .andWhere('fc.paymentStatus IN (:...estados)', {
        estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
      })
      .andWhere('fc.saldoPendiente > 0')
      .andWhere('fc.estado NOT IN (:...excluidos)', {
        excluidos: [GastoEstado.ANULADO, GastoEstado.BORRADOR],
      })
      .orderBy('fc.fechaVencimiento', 'ASC')
      .getMany();
  }

  async registrarCobroMultiple(
    dto: RegistrarPagoMultipleDto,
    userId: string,
  ): Promise<{ pago: Pago; detalles: PagoFacturaDetalle[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar cliente
      const cliente = await queryRunner.manager.findOne(Cliente, {
        where: { id: dto.terceroId },
      });
      if (!cliente) {
        throw new NotFoundException(`Cliente con ID ${dto.terceroId} no encontrado`);
      }

      // 2. Validar medio de pago y banco
      let medioPago = dto.medioPago;
      let metodoPagoRel: MetodoPago | null = null;
      if (dto.metodoPagoId) {
        metodoPagoRel = await queryRunner.manager.findOne(MetodoPago, {
          where: { id: dto.metodoPagoId },
        });
        if (!metodoPagoRel) {
          throw new NotFoundException(`Método de pago con ID ${dto.metodoPagoId} no encontrado`);
        }
        medioPago = this.getMedioPagoFromCodigo(metodoPagoRel.codigo);
      } else if (!medioPago) {
        throw new BadRequestException('Debe especificar metodoPagoId');
      }

      if (medioPago !== MedioPago.CAJA && !dto.cuentaBancariaId) {
        throw new BadRequestException('Debe especificar cuentaBancariaId cuando el medio de pago no es caja');
      }

      let cuentaBancaria: CuentasBancarias | null = null;
      if (dto.cuentaBancariaId) {
        cuentaBancaria = await queryRunner.manager.findOne(CuentasBancarias, {
          where: { id: dto.cuentaBancariaId, activa: true },
        });
        if (!cuentaBancaria) {
          throw new NotFoundException(`Cuenta bancaria ${dto.cuentaBancariaId} no encontrada o inactiva`);
        }
      }

      let montoTotal = 0;
      const facturasAbonos: Array<{ facturaVenta: FacturasVenta; monto: number }> = [];

      // 3. Procesar y actualizar cada factura
      for (const item of dto.detalles) {
        const factura = await queryRunner.manager.findOne(FacturasVenta, {
          where: { id: item.facturaId },
          relations: ['client'],
        });

        if (!factura) {
          throw new NotFoundException(`Factura de venta con ID ${item.facturaId} no encontrada`);
        }

        if (factura.paymentStatus === PaymentStatus.PAID) {
          throw new BadRequestException(`La factura ${factura.comprobante_completo} ya está pagada`);
        }

        if (item.monto > factura.saldoPendiente) {
          throw new BadRequestException(`El monto $${item.monto} supera el saldo pendiente de $${factura.saldoPendiente} para la factura ${factura.comprobante_completo}`);
        }

        // Actualizar saldos de factura
        const nuevoTotalPagado = MathUtil.sum(factura.totalPagado, item.monto);
        const nuevoSaldoPendiente = MathUtil.sub(factura.total, nuevoTotalPagado);
        const nuevoPaymentStatus = nuevoSaldoPendiente === 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

        await queryRunner.manager.update(FacturasVenta, { id: factura.id }, {
          totalPagado: nuevoTotalPagado,
          saldoPendiente: nuevoSaldoPendiente,
          paymentStatus: nuevoPaymentStatus,
        });

        montoTotal = MathUtil.sum(montoTotal, item.monto);
        facturasAbonos.push({ facturaVenta: factura, monto: item.monto });
      }

      // 4. Generar asiento contable
      const cuentaDebitoCode = medioPago === MedioPago.CAJA ? '1105' : '1110';
      let asientoId: string = '';
      try {
        const asiento = await this.asientosContablesService.generarAsientoCobroMultiple(
          {
            clienteId: dto.terceroId,
            facturasAbonos,
            montoTotal,
            fecha: new Date(dto.fecha),
            cuentaDebitoCodigo: cuentaDebitoCode,
            cuentaBancariaId: dto.cuentaBancariaId,
            medioPago: medioPago,
            userId,
          },
          queryRunner,
        );
        asientoId = asiento.id;
      } catch (asientoError) {
        this.logger.error(`Error generando asiento cobro múltiple: ${asientoError.message}`);
      }

      // 5. Crear cabecera de Pago
      const numeroComprobante = await this.generarNumeroPago(queryRunner, TipoPago.COBRO);
      const pago = queryRunner.manager.create(Pago, {
        numero: numeroComprobante,
        tipo: TipoPago.COBRO,
        clienteId: dto.terceroId,
        fecha: new Date(dto.fecha),
        monto: montoTotal,
        medioPago: medioPago,
        metodoPagoId: metodoPagoRel?.id || null,
        cuentaBancariaId: dto.cuentaBancariaId || null,
        referencia: dto.referencia || null,
        notas: dto.notas || null,
        asientoId,
        creadoPorId: userId,
        createdAt: new Date(),
        // Para compatibilidad legada: guardar el primer id de factura
        facturaVentaId: dto.detalles[0]?.facturaId || null,
      });

      const pagoGuardado = await queryRunner.manager.save(Pago, pago);

      // 6. Crear detalles de pago
      const detallesGuardados: PagoFacturaDetalle[] = [];
      for (const item of dto.detalles) {
        const detalle = queryRunner.manager.create(PagoFacturaDetalle, {
          pagoId: pagoGuardado.id,
          facturaVentaId: item.facturaId,
          monto: item.monto,
        });
        detallesGuardados.push(await queryRunner.manager.save(PagoFacturaDetalle, detalle));
      }

      // 7. Actualizar saldo banco/caja
      if (cuentaBancaria) {
        const nuevoSaldo = MathUtil.sum(cuentaBancaria.saldoActual, montoTotal);
        await queryRunner.manager.update(
          CuentasBancarias,
          { id: cuentaBancaria.id },
          { saldoActual: nuevoSaldo },
        );
      }

      await queryRunner.commitTransaction();
      return { pago: pagoGuardado, detalles: detallesGuardados };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error registrando cobro múltiple: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registrarPagoMultiple(
    dto: RegistrarPagoMultipleDto,
    userId: string,
  ): Promise<{ pago: Pago; detalles: PagoFacturaDetalle[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar proveedor
      const proveedor = await queryRunner.manager.findOne(Proveedor, {
        where: { id: dto.terceroId },
      });
      if (!proveedor) {
        throw new NotFoundException(`Proveedor con ID ${dto.terceroId} no encontrado`);
      }

      // 2. Validar medio de pago y banco
      let medioPago = dto.medioPago;
      let metodoPagoRel: MetodoPago | null = null;
      if (dto.metodoPagoId) {
        metodoPagoRel = await queryRunner.manager.findOne(MetodoPago, {
          where: { id: dto.metodoPagoId },
        });
        if (!metodoPagoRel) {
          throw new NotFoundException(`Método de pago con ID ${dto.metodoPagoId} no encontrado`);
        }
        medioPago = this.getMedioPagoFromCodigo(metodoPagoRel.codigo);
      } else if (!medioPago) {
        throw new BadRequestException('Debe especificar metodoPagoId');
      }

      if (medioPago !== MedioPago.CAJA && !dto.cuentaBancariaId) {
        throw new BadRequestException('Debe especificar cuentaBancariaId cuando el medio de pago no es caja');
      }

      let cuentaBancaria: CuentasBancarias | null = null;
      if (dto.cuentaBancariaId) {
        cuentaBancaria = await queryRunner.manager.findOne(CuentasBancarias, {
          where: { id: dto.cuentaBancariaId, activa: true },
        });
        if (!cuentaBancaria) {
          throw new NotFoundException(`Cuenta bancaria ${dto.cuentaBancariaId} no encontrada o inactiva`);
        }
      }

      let montoTotal = 0;
      const facturasAbonos: Array<{ facturaCompra: FacturaCompra; monto: number }> = [];

      // 3. Procesar y actualizar cada factura compra
      for (const item of dto.detalles) {
        const factura = await queryRunner.manager.findOne(FacturaCompra, {
          where: { id: item.facturaId },
          relations: ['proveedor'],
        });

        if (!factura) {
          throw new NotFoundException(`Factura de compra con ID ${item.facturaId} no encontrada`);
        }

        if (factura.paymentStatus === PaymentStatus.PAID) {
          throw new BadRequestException(`La factura ${factura.numero} ya está pagada`);
        }

        if (item.monto > factura.saldoPendiente) {
          throw new BadRequestException(`El monto $${item.monto} supera el saldo pendiente de $${factura.saldoPendiente} para la factura ${factura.numero}`);
        }

        // Actualizar saldos de factura
        const nuevoTotalPagado = MathUtil.sum(factura.totalPagado, item.monto);
        const nuevoSaldoPendiente = MathUtil.sub(factura.total, nuevoTotalPagado);
        const nuevoPaymentStatus = nuevoSaldoPendiente === 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;

        await queryRunner.manager.update(FacturaCompra, { id: factura.id }, {
          totalPagado: nuevoTotalPagado,
          saldoPendiente: nuevoSaldoPendiente,
          paymentStatus: nuevoPaymentStatus,
        });

        montoTotal = MathUtil.sum(montoTotal, item.monto);
        facturasAbonos.push({ facturaCompra: factura, monto: item.monto });
      }

      // 4. Generar asiento contable
      const cuentaCreditoCode = medioPago === MedioPago.CAJA ? '1105' : '1110';
      let asientoId: string = '';
      try {
        const asiento = await this.asientosContablesService.generarAsientoPagoCompraMultiple(
          {
            proveedorId: dto.terceroId,
            facturasAbonos,
            montoTotal,
            fecha: new Date(dto.fecha),
            cuentaCreditoCodigo: cuentaCreditoCode,
            cuentaBancariaId: dto.cuentaBancariaId,
            medioPago: medioPago,
            userId,
          },
          queryRunner,
        );
        asientoId = asiento.id;
      } catch (asientoError) {
        this.logger.error(`Error generando asiento pago múltiple: ${asientoError.message}`);
      }

      // 5. Crear cabecera de Pago
      const numeroComprobante = await this.generarNumeroPago(queryRunner, TipoPago.PAGO);
      const pago = queryRunner.manager.create(Pago, {
        numero: numeroComprobante,
        tipo: TipoPago.PAGO,
        proveedorId: dto.terceroId,
        fecha: new Date(dto.fecha),
        monto: montoTotal,
        medioPago: medioPago,
        metodoPagoId: metodoPagoRel?.id || null,
        cuentaBancariaId: dto.cuentaBancariaId || null,
        referencia: dto.referencia || null,
        notas: dto.notas || null,
        asientoId,
        creadoPorId: userId,
        createdAt: new Date(),
        // Para compatibilidad legada
        facturaCompraId: dto.detalles[0]?.facturaId || null,
      });

      const pagoGuardado = await queryRunner.manager.save(Pago, pago);

      // 6. Crear detalles de pago
      const detallesGuardados: PagoFacturaDetalle[] = [];
      for (const item of dto.detalles) {
        const detalle = queryRunner.manager.create(PagoFacturaDetalle, {
          pagoId: pagoGuardado.id,
          facturaCompraId: item.facturaId,
          monto: item.monto,
        });
        detallesGuardados.push(await queryRunner.manager.save(PagoFacturaDetalle, detalle));
      }

      // 7. Actualizar saldo banco/caja
      if (cuentaBancaria) {
        const nuevoSaldo = MathUtil.sub(cuentaBancaria.saldoActual, montoTotal);
        await queryRunner.manager.update(
          CuentasBancarias,
          { id: cuentaBancaria.id },
          { saldoActual: nuevoSaldo },
        );
      }

      await queryRunner.commitTransaction();
      return { pago: pagoGuardado, detalles: detallesGuardados };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error registrando pago múltiple: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registrarOtrosMovimientos(
    dto: RegistrarOtrosConceptosDto,
    tipoPago: TipoPago,
    userId: string,
  ): Promise<{ pago: Pago; detalles: PagoConceptoDetalle[] }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const isIngreso = tipoPago === TipoPago.OTRO_INGRESO;

      // 1. Validar tercero opcional
      let cliente: Cliente | null = null;
      let proveedor: Proveedor | null = null;

      if (dto.terceroId) {
        if (isIngreso) {
          cliente = await queryRunner.manager.findOne(Cliente, { where: { id: dto.terceroId } });
        } else {
          proveedor = await queryRunner.manager.findOne(Proveedor, { where: { id: dto.terceroId } });
        }
      }

      // 2. Validar cuenta de banco si aplica
      let medioPago = dto.medioPago;
      let metodoPagoRel: MetodoPago | null = null;
      if (dto.metodoPagoId) {
        metodoPagoRel = await queryRunner.manager.findOne(MetodoPago, {
          where: { id: dto.metodoPagoId },
        });
        if (!metodoPagoRel) {
          throw new NotFoundException(`Método de pago con ID ${dto.metodoPagoId} no encontrado`);
        }
        medioPago = this.getMedioPagoFromCodigo(metodoPagoRel.codigo);
      } else if (!medioPago) {
        throw new BadRequestException('Debe especificar metodoPagoId');
      }

      if (medioPago !== MedioPago.CAJA && !dto.cuentaBancariaId) {
        throw new BadRequestException('Debe especificar cuentaBancariaId cuando el medio de pago no es caja');
      }

      let cuentaBancaria: CuentasBancarias | null = null;
      if (dto.cuentaBancariaId) {
        cuentaBancaria = await queryRunner.manager.findOne(CuentasBancarias, {
          where: { id: dto.cuentaBancariaId, activa: true },
        });
        if (!cuentaBancaria) {
          throw new NotFoundException(`Cuenta bancaria ${dto.cuentaBancariaId} no encontrada o inactiva`);
        }
      }

      // 3. Validar cuentas contables e impuestos, e integrar totalizador
      let montoTotal = 0;
      for (const item of dto.conceptos) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: item.cuentaContableId },
        });
        if (!cuenta) {
          throw new NotFoundException(`Cuenta contable con ID ${item.cuentaContableId} no encontrada`);
        }

        const base = item.cantidad * item.valorUnitario;
        const porc = item.impuestoPorcentaje || 0;
        const impuestoMonto = base * (porc / 100);
        const itemTotal = base + impuestoMonto;

        montoTotal = MathUtil.sum(montoTotal, itemTotal);
      }

      // 4. Generar asiento contable
      let asientoId: string = '';
      try {
        const asiento = await this.asientosContablesService.generarAsientoOtrosMovimientos(
          {
            tipoPago,
            conceptos: dto.conceptos,
            montoTotal,
            fecha: new Date(dto.fecha),
            cuentaBancariaId: dto.cuentaBancariaId,
            medioPago: medioPago,
            userId,
          },
          queryRunner,
        );
        asientoId = asiento.id;
      } catch (asientoError) {
        this.logger.error(`Error generando asiento de otros movimientos: ${asientoError.message}`);
      }

      // 5. Crear cabecera de Pago
      const numeroComprobante = await this.generarNumeroPago(queryRunner, tipoPago);
      const pago = queryRunner.manager.create(Pago, {
        numero: numeroComprobante,
        tipo: tipoPago,
        clienteId: cliente?.id || null,
        proveedorId: proveedor?.id || null,
        fecha: new Date(dto.fecha),
        monto: montoTotal,
        medioPago: medioPago,
        metodoPagoId: metodoPagoRel?.id || null,
        cuentaBancariaId: dto.cuentaBancariaId || null,
        referencia: dto.referencia || null,
        notas: dto.notas || null,
        asientoId,
        creadoPorId: userId,
        createdAt: new Date(),
      });

      const pagoGuardado = await queryRunner.manager.save(Pago, pago);

      // 6. Crear detalles de conceptos e identificar anticipos
      const detallesGuardados: PagoConceptoDetalle[] = [];
      for (const item of dto.conceptos) {
        const base = item.cantidad * item.valorUnitario;
        const porc = item.impuestoPorcentaje || 0;
        const impuestoMonto = base * (porc / 100);
        const itemTotal = base + impuestoMonto;

        const detalle = queryRunner.manager.create(PagoConceptoDetalle, {
          pagoId: pagoGuardado.id,
          cuentaContableId: item.cuentaContableId,
          concepto: item.concepto,
          cantidad: item.cantidad,
          valorUnitario: item.valorUnitario,
          impuestoPorcentaje: porc,
          impuestoId: item.impuestoId || null,
          total: itemTotal,
        });

        const savedDetalle = await queryRunner.manager.save(PagoConceptoDetalle, detalle);
        detallesGuardados.push(savedDetalle);

        // Verificar si la cuenta corresponde a un anticipo
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: item.cuentaContableId },
        });
        if (cuenta) {
          const esAnticipoCliente = (cuenta.codigo.startsWith('2805') || cuenta.codigo.startsWith('2815')) && isIngreso && dto.terceroId;
          const esAnticipoProveedor = cuenta.codigo.startsWith('1330') && !isIngreso && dto.terceroId;

          if (esAnticipoCliente || esAnticipoProveedor) {
            const anticipo = queryRunner.manager.create(Anticipo, {
              numero: pagoGuardado.numero,
              tipo: esAnticipoCliente ? AnticipoTipo.CLIENTE : AnticipoTipo.PROVEEDOR,
              clienteId: esAnticipoCliente ? dto.terceroId : null,
              proveedorId: esAnticipoProveedor ? dto.terceroId : null,
              fecha: new Date(dto.fecha),
              montoOriginal: itemTotal,
              saldoDisponible: itemTotal,
              cuentaContableId: item.cuentaContableId,
              pagoId: pagoGuardado.id,
              estado: AnticipoEstado.PENDIENTE,
              createdAt: new Date(),
            });
            await queryRunner.manager.save(Anticipo, anticipo);
            this.logger.log(`Anticipo de ${esAnticipoCliente ? 'cliente' : 'proveedor'} creado de forma automática: ${pagoGuardado.numero} por $${itemTotal}`);
          }
        }
      }

      // 7. Actualizar saldo banco/caja
      if (cuentaBancaria) {
        const nuevoSaldo = isIngreso
          ? MathUtil.sum(cuentaBancaria.saldoActual, montoTotal)
          : MathUtil.sub(cuentaBancaria.saldoActual, montoTotal);

        await queryRunner.manager.update(
          CuentasBancarias,
          { id: cuentaBancaria.id },
          { saldoActual: nuevoSaldo },
        );
      }

      await queryRunner.commitTransaction();
      return { pago: pagoGuardado, detalles: detallesGuardados };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error registrando otros movimientos: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async obtenerAnticiposDisponiblesCliente(clienteId: string): Promise<Anticipo[]> {
    return this.anticipoRepository.createQueryBuilder('anticipo')
      .where('anticipo.clienteId = :clienteId', { clienteId })
      .andWhere('anticipo.tipo = :tipo', { tipo: 'cliente' })
      .andWhere('anticipo.saldoDisponible > 0')
      .andWhere('anticipo.estado IN (:...estados)', { estados: ['pendiente', 'parcial'] })
      .orderBy('anticipo.fecha', 'ASC')
      .getMany();
  }

  async obtenerAnticiposDisponiblesProveedor(proveedorId: string): Promise<Anticipo[]> {
    return this.anticipoRepository.createQueryBuilder('anticipo')
      .where('anticipo.proveedorId = :proveedorId', { proveedorId })
      .andWhere('anticipo.tipo = :tipo', { tipo: 'proveedor' })
      .andWhere('anticipo.saldoDisponible > 0')
      .andWhere('anticipo.estado IN (:...estados)', { estados: ['pendiente', 'parcial'] })
      .orderBy('anticipo.fecha', 'ASC')
      .getMany();
  }

  async obtenerAplicacionesFacturaVenta(facturaVentaId: string): Promise<AnticipoAplicacion[]> {
    return this.anticipoAplicacionRepository.find({
      where: {
        facturaVentaId,
        estado: In([AplicacionEstado.ACTIVO, AplicacionEstado.BORRADOR]),
      },
      relations: ['anticipo'],
    });
  }

  async obtenerAplicacionesFacturaCompra(facturaCompraId: string): Promise<AnticipoAplicacion[]> {
    return this.anticipoAplicacionRepository.find({
      where: {
        facturaCompraId,
        estado: In([AplicacionEstado.ACTIVO, AplicacionEstado.BORRADOR]),
      },
      relations: ['anticipo'],
    });
  }

  async anularPago(pagoId: string, motivo: string, userId: string): Promise<Pago> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscar el pago con todas sus relaciones necesarias
      const pago = await queryRunner.manager.findOne(Pago, {
        where: { id: pagoId },
        relations: [
          'cuentaBancaria',
          'facturasDetalles',
          'facturasDetalles.facturaVenta',
          'facturasDetalles.facturaCompra',
          'facturaVenta',
          'facturaCompra',
        ],
      });

      if (!pago) {
        throw new NotFoundException(`Pago con ID ${pagoId} no encontrado`);
      }

      // 2. Validar que no esté ya anulado
      if (pago.estado === EstadoPago.ANULADO) {
        throw new BadRequestException('El pago ya se encuentra anulado');
      }

      // 3. Validar si tiene un anticipo generado y si ese anticipo ya se aplicó
      const anticipo = await queryRunner.manager.findOne(Anticipo, {
        where: { pagoId: pago.id },
      });

      if (anticipo) {
        // Verificar si el anticipo tiene aplicaciones activas
        const aplicaciones = await queryRunner.manager.count(AnticipoAplicacion, {
          where: {
            anticipoId: anticipo.id,
            estado: AplicacionEstado.ACTIVO,
          },
        });

        if (aplicaciones > 0) {
          throw new BadRequestException(
            `El anticipo generado por este pago ya ha sido cruzado en facturas. Debe anular primero las aplicaciones de anticipo correspondientes.`,
          );
        }
      }

      // 4. Cambiar el estado del pago a ANULADO
      pago.estado = EstadoPago.ANULADO;
      pago.motivoAnulacion = motivo;
      await queryRunner.manager.save(Pago, pago);

      // 5. Reversar el saldo de la caja o banco si aplica
      if (pago.cuentaBancariaId) {
        const cta = await queryRunner.manager.findOne(CuentasBancarias, {
          where: { id: pago.cuentaBancariaId },
        });

        if (cta) {
          const montoNum = Number(pago.monto);
          if (pago.tipo === TipoPago.COBRO || pago.tipo === TipoPago.OTRO_INGRESO) {
            // Ingreso: restamos el dinero recibido
            cta.saldoActual = MathUtil.sub(cta.saldoActual, montoNum);
          } else if (pago.tipo === TipoPago.PAGO || pago.tipo === TipoPago.OTRO_EGRESO) {
            // Egreso: sumamos el dinero devuelto
            cta.saldoActual = MathUtil.sum(cta.saldoActual, montoNum);
          }
          await queryRunner.manager.save(CuentasBancarias, cta);
        }
      }

      // 6. Liberar facturas asociadas y reversar sus saldos
      if (pago.tipo === TipoPago.COBRO) {
        // Cobros (Facturas de venta)
        if (pago.facturasDetalles && pago.facturasDetalles.length > 0) {
          for (const det of pago.facturasDetalles) {
            if (det.facturaVentaId) {
              const fv = await queryRunner.manager.findOne(FacturasVenta, {
                where: { id: det.facturaVentaId },
              });
              if (fv) {
                const montoAbono = Number(det.monto);
                fv.totalPagado = MathUtil.sub(fv.totalPagado, montoAbono);
                fv.saldoPendiente = MathUtil.sum(fv.saldoPendiente, montoAbono);
                fv.paymentStatus = fv.totalPagado === 0 ? PaymentStatus.PENDING : PaymentStatus.PARTIAL;
                await queryRunner.manager.save(FacturasVenta, fv);
              }
            }
          }
        } else if (pago.facturaVentaId) {
          const fv = await queryRunner.manager.findOne(FacturasVenta, {
            where: { id: pago.facturaVentaId },
          });
          if (fv) {
            const montoAbono = Number(pago.monto);
            fv.totalPagado = MathUtil.sub(fv.totalPagado, montoAbono);
            fv.saldoPendiente = MathUtil.sum(fv.saldoPendiente, montoAbono);
            fv.paymentStatus = fv.totalPagado === 0 ? PaymentStatus.PENDING : PaymentStatus.PARTIAL;
            await queryRunner.manager.save(FacturasVenta, fv);
          }
        }
      } else if (pago.tipo === TipoPago.PAGO) {
        // Pagos (Facturas de compra)
        if (pago.facturasDetalles && pago.facturasDetalles.length > 0) {
          for (const det of pago.facturasDetalles) {
            if (det.facturaCompraId) {
              const fc = await queryRunner.manager.findOne(FacturaCompra, {
                where: { id: det.facturaCompraId },
              });
              if (fc) {
                const montoAbono = Number(det.monto);
                fc.totalPagado = MathUtil.sub(fc.totalPagado, montoAbono);
                fc.saldoPendiente = MathUtil.sum(fc.saldoPendiente, montoAbono);
                fc.paymentStatus = fc.totalPagado === 0 ? PaymentStatus.PENDING : PaymentStatus.PARTIAL;
                await queryRunner.manager.save(FacturaCompra, fc);
              }
            }
          }
        } else if (pago.facturaCompraId) {
          const fc = await queryRunner.manager.findOne(FacturaCompra, {
            where: { id: pago.facturaCompraId },
          });
          if (fc) {
            const montoAbono = Number(pago.monto);
            fc.totalPagado = MathUtil.sub(fc.totalPagado, montoAbono);
            fc.saldoPendiente = MathUtil.sum(fc.saldoPendiente, montoAbono);
            fc.paymentStatus = fc.totalPagado === 0 ? PaymentStatus.PENDING : PaymentStatus.PARTIAL;
            await queryRunner.manager.save(FacturaCompra, fc);
          }
        }
      }

      // 7. Si existía un anticipo, anularlo
      if (anticipo) {
        anticipo.estado = AnticipoEstado.ANULADO;
        anticipo.saldoDisponible = 0;
        await queryRunner.manager.save(Anticipo, anticipo);
      }

      // 8. Generar asiento contable de reverso (si el pago original tenía asiento contable)
      if (pago.asientoId) {
        let tipoReverso = TipoAsiento.ANULACION_COBRO;
        if (pago.tipo === TipoPago.PAGO) {
          tipoReverso = TipoAsiento.ANULACION_PAGO_PROVEEDOR;
        } else if (pago.tipo === TipoPago.OTRO_INGRESO) {
          tipoReverso = TipoAsiento.ANULACION_OTROS_INGRESOS;
        } else if (pago.tipo === TipoPago.OTRO_EGRESO) {
          tipoReverso = TipoAsiento.ANULACION_OTROS_EGRESOS;
        }

        const asientoReverso = await this.asientosContablesService.generarAsientoReverso(
          pago.asientoId,
          tipoReverso,
          userId,
          queryRunner,
        );

        this.logger.log(`Asiento contable de reverso generado exitosamente: ${asientoReverso.numero}`);
      }

      await queryRunner.commitTransaction();
      return pago;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al anular el pago: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}