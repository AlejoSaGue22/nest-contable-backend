import { Injectable, Logger } from '@nestjs/common';
import { FactusV2PaymentDetail } from 'src/api-dian/interfaces/api-dian-interface';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';

/**
 * Resuelve `payment_details` de la NC sin exponerlo en la UI ni acoplarlo
 * al modelo contable (guía NC 2026 §Factus).
 *
 * Factus V2 documenta `payment_details` como requerido en
 * POST /v2/credit-notes/validate, pero NO está confirmado qué combinación
 * acepta el sandbox por concepto. Por eso NADA está fijado: cada estrategia
 * es una candidata explícita y `candidates()` expone la matriz para probar
 * en sandbox antes de fijar la estrategia por defecto.
 *
 * Estrategias:
 * - espejo-factura: replica forma/método de la factura fuente.
 * - contado-10: pago de contado, medio 10 (efectivo). Fallback seguro cuando
 *   la factura es a crédito sin fecha de vencimiento (Factus exige due_date).
 * - credito-30d: a crédito con vencimiento +30 días (solo sonda).
 */
export type PaymentStrategyName = 'espejo-factura' | 'contado-10' | 'credito-30d';

/**
 * Estrategia por defecto CONFIRMADA (2026-09-24):
 * espejo-factura. La NC electrónica usa las formas de pago relacionadas en
 * la factura electrónica fuente (efectivo/pago inmediato → misma forma),
 * con amount = valor total de la NC.
 */
export const DEFAULT_PAYMENT_STRATEGY: PaymentStrategyName = 'espejo-factura';

export interface PaymentResolution {
  strategy: PaymentStrategyName;
  details: FactusV2PaymentDetail[];
  warnings: string[];
}

@Injectable()
export class PaymentDetailsResolver {
  private readonly logger = new Logger(PaymentDetailsResolver.name);

  /**
   * Resuelve con la estrategia por defecto (espejo-factura) salvo override
   * explícito (sonda sandbox). Si la factura es a crédito sin vencimiento,
   * cae a contado espejando el método, con warning (evita 422 por
   * due_date faltante). La estrategia efectiva queda en el log.
   */
  resolve(
    factura: FacturasVenta,
    totalNota: number,
    strategy?: PaymentStrategyName,
  ): PaymentResolution {
    const name = strategy ?? DEFAULT_PAYMENT_STRATEGY;
    let resolution: PaymentResolution;
    switch (name) {
      case 'contado-10':
        resolution = { strategy: name, details: [this.contado(totalNota)], warnings: [] };
        break;
      case 'credito-30d':
        resolution = {
          strategy: name,
          details: [this.credito(totalNota, factura.metodoPago || '10', this.masDias(30))],
          warnings: [],
        };
        break;
      default:
        resolution = this.espejoSeguro(factura, totalNota);
        break;
    }
    this.logger.log(
      `payment_details [${resolution.strategy}] FE=${factura.comprobante_completo} total=${resolution.details[0]?.amount}`,
    );
    return resolution;
  }

  /** Matriz de candidatas para la sonda de sandbox (sin enviar a Factus). */
  candidates(factura: FacturasVenta, totalNota: number): PaymentResolution[] {
    return [
      this.espejoSeguro(factura, totalNota),
      { strategy: 'contado-10', details: [this.contado(totalNota)], warnings: [] },
      {
        strategy: 'credito-30d',
        details: [this.credito(totalNota, factura.metodoPago || '10', this.masDias(30))],
        warnings: [],
      },
    ];
  }

  private espejoSeguro(factura: FacturasVenta, totalNota: number): PaymentResolution {
    const warnings: string[] = [];
    const esCredito = factura.formaPago === 'CREDITO';
    const amount = this.decimal(totalNota);

    if (!esCredito) {
      return {
        strategy: 'espejo-factura',
        details: [
          {
            payment_form: '1',
            payment_method_code: factura.metodoPago || '10',
            amount,
          },
        ],
        warnings,
      };
    }

    const vencimiento = factura.fechaVencimiento
      ? new Date(factura.fechaVencimiento).toISOString().slice(0, 10)
      : undefined;
    if (!vencimiento) {
      warnings.push(
        'Factura a crédito sin fecha de vencimiento: se usa contado con el mismo método de la factura (Factus exige due_date en crédito)',
      );
      this.logger.warn(warnings[0]);
      return {
        strategy: 'espejo-factura',
        details: [
          {
            payment_form: '1',
            payment_method_code: factura.metodoPago || '10',
            amount,
          },
        ],
        warnings,
      };
    }

    return {
      strategy: 'espejo-factura',
      details: [
        {
          payment_form: '2',
          payment_method_code: factura.metodoPago || '10',
          amount,
          due_date: vencimiento,
        },
      ],
      warnings,
    };
  }

  private contado(totalNota: number): FactusV2PaymentDetail {
    return { payment_form: '1', payment_method_code: '10', amount: this.decimal(totalNota) };
  }

  private credito(totalNota: number, methodCode: string, dueDate: string): FactusV2PaymentDetail {
    return {
      payment_form: '2',
      payment_method_code: methodCode,
      amount: this.decimal(totalNota),
      due_date: dueDate,
    };
  }

  private masDias(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  private decimal(value: number | string | null | undefined): string {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return '0.00';
    return num.toFixed(2);
  }
}
