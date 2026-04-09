import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Pago } from './entities/pago.entity';
import { TipoPago, MedioPago, PaymentStatus } from './enums/pago.enum';

import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';

import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { RegistrarCobroDto, RegistrarPagoDto } from './dto/create-pago.dto';
import { FormaPago, InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { MathUtil } from 'src/common/utils/math.util';

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
  // CUENTAS BANCARIAS
  // ═══════════════════════════════════════════════════════════════

  async findCuentasBancarias(): Promise<CuentasBancarias[]> {
    return this.cuentaBancariaRepository.find({
      where: { activa: true },
      order: { nombre: 'ASC' },
    });
  }
}