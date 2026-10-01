import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotaAjuste } from '../entities/notas-ajuste.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { ConceptoNotaCredito, EstadoNota, TipoNota } from '../enums/notas-ajuste.enum';
import { MathUtil } from 'src/common/utils/math.util';

/**
 * Disponibilidad por concepto (guía NC 2026 §2).
 *
 * Cada concepto consume una dimensión distinta del documento fuente:
 * - Devolución (1) / Anulación (2) → CANTIDAD disponible por línea.
 * - Descuento (3/5/6) → VALOR DE DESCUENTO disponible por línea.
 * - Ajuste de precio (4) → VALOR DE AJUSTE disponible por línea.
 * - Anulación (2) → DOCUMENTO completo disponible (marca todo no disponible).
 *
 * Consumen disponibilidad los estados que ya tienen efecto o reserva:
 * aceptada, emitida (estándar), enviada (en vuelo a DIAN) y error_asiento
 * (aceptada por DIAN pero sin asiento). Borrador, rechazada y anulada no.
 */
export interface DisponibilidadLinea {
  articuloId: string;
  cantidadOriginal: number;
  precioOriginal: number;
  baseOriginal: number;
  ivaOriginal: number;
  totalOriginal: number;
  // Devolución / anulación
  cantidadAcreditada: number;
  cantidadDisponible: number;
  // Descuento (3/5/6)
  descuentoAplicado: number;
  descuentoDisponible: number;
  // Ajuste de precio (4)
  ajusteAplicado: number;
  ajusteDisponible: number;
}

export interface DisponibilidadFactura {
  facturaId: string;
  facturaNumero: string;
  lineas: DisponibilidadLinea[];
  documento: {
    totalFactura: number;
    totalAcreditado: number;
    saldoDisponible: number;
    anulada: boolean;
    bloqueada: boolean;
  };
}

const ESTADOS_QUE_CONSUMEN = [
  EstadoNota.ACCEPTED,
  EstadoNota.ISSUED,
  EstadoNota.SENT,
  EstadoNota.ERROR_ASIENTO,
];

const CONCEPTOS_DESCUENTO = [
  ConceptoNotaCredito.REBAJA_DESCUENTO,
  ConceptoNotaCredito.DESCUENTO_PRONTO_PAGO,
  ConceptoNotaCredito.DESCUENTO_VOLUMEN,
];

@Injectable()
export class DisponibilidadNotaService {
  constructor(
    @InjectRepository(FacturasVenta)
    private readonly facturaRepository: Repository<FacturasVenta>,
    @InjectRepository(NotaAjuste)
    private readonly notaRepository: Repository<NotaAjuste>,
  ) {}

  /** Factura fuente para la sonda de pago (sin relaciones pesadas). */
  async facturaFuente(facturaId: string): Promise<FacturasVenta> {
    const factura = await this.facturaRepository.findOne({ where: { id: facturaId } });
    if (!factura) {
      throw new NotFoundException('Factura original no encontrada');
    }
    return factura;
  }

  async calcular(facturaId: string): Promise<DisponibilidadFactura> {
    const factura = await this.facturaRepository.findOne({
      where: { id: facturaId },
      relations: ['items'],
    });
    if (!factura) {
      throw new NotFoundException('Factura original no encontrada');
    }

    const notas = await this.notaRepository.find({
      where: {
        facturaOriginalId: facturaId,
        tipo: TipoNota.CREDITO,
        estado: In(ESTADOS_QUE_CONSUMEN),
      },
      relations: ['items'],
    });

    const cantidadPorArticulo = new Map<string, number>();
    const descuentoPorArticulo = new Map<string, number>();
    const ajustePorArticulo = new Map<string, number>();
    let totalAcreditado = 0;
    let anulada = false;

    for (const nota of notas) {
      totalAcreditado = MathUtil.sum(totalAcreditado, Number(nota.total));
      if (nota.concepto === ConceptoNotaCredito.ANULACION) {
        anulada = true;
      }
      for (const item of nota.items ?? []) {
        const key = item.articuloId;
        if (!key) continue;
        if (
          nota.concepto === ConceptoNotaCredito.DEVOLUCION_PARCIAL ||
          nota.concepto === ConceptoNotaCredito.ANULACION
        ) {
          cantidadPorArticulo.set(
            key,
            MathUtil.sum(cantidadPorArticulo.get(key) ?? 0, Number(item.cantidad)),
          );
        } else if (CONCEPTOS_DESCUENTO.includes(nota.concepto as ConceptoNotaCredito)) {
          // V2 guarda el monto en descuentoValorInput (valorDescuento=0 porque
          // el descuento ES el crédito); legacy lo trae en valorDescuento.
          const monto = Number(item.descuentoValorInput ?? item.valorDescuento ?? 0);
          descuentoPorArticulo.set(
            key,
            MathUtil.sum(descuentoPorArticulo.get(key) ?? 0, monto),
          );
        } else if (nota.concepto === ConceptoNotaCredito.AJUSTE_PRECIO) {
          ajustePorArticulo.set(
            key,
            MathUtil.sum(ajustePorArticulo.get(key) ?? 0, Number(item.total)),
          );
        }
      }
    }

    const lineas: DisponibilidadLinea[] = (factura.items ?? []).map((fi) => {
      const cantidadOriginal = Number(fi.quantity);
      const baseOriginal = Number(fi.subtotal);
      const descuentoOrigen = Number(fi.valor_discount ?? 0);
      const cantidadAcreditada = cantidadPorArticulo.get(fi.articuloId) ?? 0;
      const descuentoAplicado = descuentoPorArticulo.get(fi.articuloId) ?? 0;
      const ajusteAplicado = ajustePorArticulo.get(fi.articuloId) ?? 0;

      return {
        articuloId: fi.articuloId,
        cantidadOriginal,
        precioOriginal: Number(fi.unitPrice),
        baseOriginal,
        ivaOriginal: Number(fi.valor_iva ?? 0),
        totalOriginal: Number(fi.total),
        cantidadAcreditada,
        cantidadDisponible: Math.max(0, MathUtil.sub(cantidadOriginal, cantidadAcreditada)),
        descuentoAplicado,
        descuentoDisponible: Math.max(
          0,
          MathUtil.sub(MathUtil.sub(baseOriginal, descuentoOrigen), descuentoAplicado),
        ),
        ajusteAplicado,
        ajusteDisponible: Math.max(0, MathUtil.sub(baseOriginal, ajusteAplicado)),
      };
    });

    const totalFactura = Number(factura.total);
    const saldoDisponible = anulada
      ? 0
      : Math.max(0, MathUtil.sub(totalFactura, totalAcreditado));

    return {
      facturaId: factura.id,
      facturaNumero: factura.comprobante_completo,
      lineas,
      documento: {
        totalFactura,
        totalAcreditado,
        saldoDisponible,
        anulada,
        bloqueada: anulada || saldoDisponible <= 0,
      },
    };
  }
}
