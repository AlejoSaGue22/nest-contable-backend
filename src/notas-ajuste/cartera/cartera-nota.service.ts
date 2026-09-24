import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { NotaAjuste } from '../entities/notas-ajuste.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { PaymentStatus } from 'src/pagos/enums/pago.enum';
import { MathUtil } from 'src/common/utils/math.util';

/**
 * Sincronización de cartera al aceptar/anular Nota Crédito.
 *
 * Invariante del sistema: saldoPendiente = total − totalPagado
 * (pagos.service la recomputa así en cada cobro). Por eso el crédito de la
 * NC vive en `totalPagado` y NO como ajuste directo del saldo: un cobro
 * posterior no borra el efecto de la NC.
 *
 * - NC normal: el cliente debe menos → totalPagado += min(totalNC, saldo).
 *   Si el saldo es 0 (factura ya pagada), no se mueve cartera: la NC queda
 *   como saldo a favor documentado y el reembolso en efectivo es un evento
 *   aparte (fuera de alcance v1).
 * - NC con esReembolsoAbono: se devuelve un abono en efectivo →
 *   totalPagado −= totalNC y el saldo sube (espejo de anular-cobro).
 * - Idempotencia: `saldoAplicado` + `valorAplicadoCartera` (reversa exacta).
 */
@Injectable()
export class CarteraNotaService {
  private readonly logger = new Logger(CarteraNotaService.name);

  /** Aplica la NC a la cartera. Retorna el valor aplicado (0 si no aplicó). */
  async aplicar(manager: EntityManager, nota: NotaAjuste): Promise<number> {
    if (nota.saldoAplicado) {
      return Number(nota.valorAplicadoCartera ?? 0);
    }
    const factura = await manager.findOne(FacturasVenta, {
      where: { id: nota.facturaOriginalId },
    });
    if (!factura) {
      this.logger.warn(`Cartera: factura ${nota.facturaOriginalId} no encontrada, se omite`);
      return 0;
    }

    const totalNC = Number(nota.total);
    let aplicado = 0;

    if (nota.esReembolsoAbono) {
      // Devolución de abono en efectivo: baja lo pagado, sube el saldo.
      aplicado = Math.min(totalNC, Number(factura.totalPagado));
      const nuevoPagado = MathUtil.sub(Number(factura.totalPagado), aplicado);
      await this.guardar(manager, factura, nuevoPagado);
      this.logger.log(
        `Cartera: NC reembolso ${nota.numeroCompleto} devuelve $${aplicado} a ${factura.comprobante_completo}`,
      );
    } else {
      const saldo = Number(factura.saldoPendiente);
      if (saldo <= 0) {
        this.logger.log(
          `Cartera: ${factura.comprobante_completo} sin saldo (pagada); NC ${nota.numeroCompleto} no mueve cartera`,
        );
        return 0;
      }
      aplicado = Math.min(totalNC, saldo);
      const nuevoPagado = MathUtil.sum(Number(factura.totalPagado), aplicado);
      await this.guardar(manager, factura, nuevoPagado);
      this.logger.log(
        `Cartera: NC ${nota.numeroCompleto} acredita $${aplicado} a ${factura.comprobante_completo}`,
      );
    }

    await manager.update(
      NotaAjuste,
      { id: nota.id },
      { saldoAplicado: true, valorAplicadoCartera: aplicado },
    );
    return aplicado;
  }

  /** Revierte la aplicación (al anular la NC). Retorna el valor reversado. */
  async revertir(manager: EntityManager, nota: NotaAjuste): Promise<number> {
    if (!nota.saldoAplicado) {
      return 0;
    }
    const factura = await manager.findOne(FacturasVenta, {
      where: { id: nota.facturaOriginalId },
    });
    if (!factura) {
      this.logger.warn(`Cartera: factura ${nota.facturaOriginalId} no encontrada, se omite reversa`);
      return 0;
    }

    const aplicado = Number(nota.valorAplicadoCartera ?? 0);
    const pagado = Number(factura.totalPagado);
    const nuevoPagado = nota.esReembolsoAbono
      ? MathUtil.sum(pagado, aplicado)
      : Math.max(0, MathUtil.sub(pagado, aplicado));
    await this.guardar(manager, factura, nuevoPagado);

    await manager.update(NotaAjuste, { id: nota.id }, { saldoAplicado: false });
    this.logger.log(
      `Cartera: reversa de NC ${nota.numeroCompleto} por $${aplicado} en ${factura.comprobante_completo}`,
    );
    return aplicado;
  }

  private async guardar(manager: EntityManager, factura: FacturasVenta, totalPagado: number) {
    const saldo = Math.max(0, MathUtil.sub(Number(factura.total), totalPagado));
    const paymentStatus =
      saldo === 0
        ? PaymentStatus.PAID
        : totalPagado > 0
          ? PaymentStatus.PARTIAL
          : PaymentStatus.PENDING;
    await manager.update(
      FacturasVenta,
      { id: factura.id },
      { totalPagado, saldoPendiente: saldo, paymentStatus },
    );
  }
}
