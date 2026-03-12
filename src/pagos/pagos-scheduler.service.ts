import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';

import {
  FacturasVenta,
  FormaPago,
  InvoiceStatus,
} from 'src/facturas-ventas/entities/facturas-venta.entity';
import {
  FacturaCompra,
  GastoEstado,
} from 'src/facturas-compras/entities/factura-compra.entity';
import { PaymentStatus } from 'src/pagos/entities/pago.entity';

/**
 * Scheduler de pagos.
 *
 * Tareas:
 *  1. marcarVencidas()         → Se ejecuta todos los días a las 2am.
 *     Detecta facturas a crédito cuya fechaVencimiento ya pasó y
 *     actualiza paymentStatus a OVERDUE.
 *
 *  2. inicializarPaymentStatus() → Se ejecuta al inicio y cada 6h (para migraciones).
 *     Asigna paymentStatus = PENDING a facturas a crédito que aún no lo tienen.
 */
@Injectable()
export class PagosSchedulerService {
  private readonly logger = new Logger(PagosSchedulerService.name);

  constructor(
    @InjectRepository(FacturasVenta)
    private readonly facturaVentaRepository: Repository<FacturasVenta>,

    @InjectRepository(FacturaCompra)
    private readonly facturaCompraRepository: Repository<FacturaCompra>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // TAREA 1: Marcar facturas vencidas (2am diario)
  // ═══════════════════════════════════════════════════════════════

  @Cron('0 2 * * *', { name: 'marcar-vencidas', timeZone: 'America/Bogota' })
  async marcarVencidas(): Promise<void> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    this.logger.log(`[Cron] Revisando facturas vencidas al ${hoy.toISOString().split('T')[0]}...`);

    try {
      // ── Facturas de venta ────────────────────────────────────────────
      const resultVentas = await this.facturaVentaRepository
        .createQueryBuilder()
        .update(FacturasVenta)
        .set({ paymentStatus: PaymentStatus.OVERDUE })
        .where('formaPago = :fp', { fp: FormaPago.CREDITO })
        .andWhere('paymentStatus IN (:...estados)', {
          estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL],
        })
        .andWhere('fechaVencimiento IS NOT NULL')
        .andWhere('fechaVencimiento < :hoy', { hoy })
        .andWhere('saldoPendiente > 0')
        .andWhere('status NOT IN (:...excluidos)', {
          excluidos: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
        })
        .execute();

      // ── Facturas de compra ───────────────────────────────────────────
      const resultCompras = await this.facturaCompraRepository
        .createQueryBuilder()
        .update(FacturaCompra)
        .set({ paymentStatus: PaymentStatus.OVERDUE })
        .where('formaPago = :fp', { fp: 'CREDITO' })
        .andWhere('paymentStatus IN (:...estados)', {
          estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL],
        })
        .andWhere('fechaVencimiento IS NOT NULL')
        .andWhere('fechaVencimiento < :hoy', { hoy })
        .andWhere('saldoPendiente > 0')
        .andWhere('estado NOT IN (:...excluidos)', {
          excluidos: [GastoEstado.ANULADO, GastoEstado.BORRADOR],
        })
        .execute();

      this.logger.log(
        `[Cron] Vencidas marcadas → Ventas: ${resultVentas.affected}, Compras: ${resultCompras.affected}`,
      );
    } catch (error) {
      this.logger.error(`[Cron] Error marcando vencidas: ${error.message}`, error.stack);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TAREA 2: Inicializar paymentStatus en facturas crédito existentes
  // Útil para migración: facturas antiguas a crédito sin paymentStatus.
  // ═══════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'inicializar-payment-status', timeZone: 'America/Bogota' })
  async inicializarPaymentStatus(): Promise<void> {
    try {
      // Facturas de venta a crédito sin paymentStatus
      const ventasSinEstado = await this.facturaVentaRepository.count({
        where: {
          formaPago:     FormaPago.CREDITO,
          paymentStatus: IsNull(),
          status:        Not(In([InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT])),
        },
      });

      if (ventasSinEstado > 0) {
        // Las que tienen saldo = 0 (ya pagadas de alguna forma) → PAID
        await this.facturaVentaRepository
          .createQueryBuilder()
          .update(FacturasVenta)
          .set({ paymentStatus: PaymentStatus.PAID, totalPagado: () => 'total', saldoPendiente: 0 })
          .where('formaPago = :fp', { fp: FormaPago.CREDITO })
          .andWhere('paymentStatus IS NULL')
          .andWhere('status = :paid', { paid: InvoiceStatus.PAID })
          .execute();

        // Las demás → PENDING
        await this.facturaVentaRepository
          .createQueryBuilder()
          .update(FacturasVenta)
          .set({ paymentStatus: PaymentStatus.PENDING, saldoPendiente: () => 'total' })
          .where('formaPago = :fp', { fp: FormaPago.CREDITO })
          .andWhere('paymentStatus IS NULL')
          .andWhere('status NOT IN (:...excluidos)', {
            excluidos: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
          })
          .execute();

        this.logger.log(`[Cron] ${ventasSinEstado} facturas de venta inicializadas con paymentStatus`);
      }

      // Facturas de compra a crédito sin paymentStatus
      await this.facturaCompraRepository
        .createQueryBuilder()
        .update(FacturaCompra)
        .set({ paymentStatus: PaymentStatus.PAID, totalPagado: () => 'total', saldoPendiente: 0 })
        .where('formaPago = :fp', { fp: 'CREDITO' })
        .andWhere('paymentStatus IS NULL')
        .andWhere('estado = :pagado', { pagado: GastoEstado.PAGADO })
        .execute();

      await this.facturaCompraRepository
        .createQueryBuilder()
        .update(FacturaCompra)
        .set({ paymentStatus: PaymentStatus.PENDING, saldoPendiente: () => 'total' })
        .where('formaPago = :fp', { fp: 'CREDITO' })
        .andWhere('paymentStatus IS NULL')
        .andWhere('estado = :registrado', { registrado: GastoEstado.REGISTRADO })
        .execute();

    } catch (error) {
      this.logger.error(
        `[Cron] Error inicializando paymentStatus: ${error.message}`,
        error.stack,
      );
    }
  }
}