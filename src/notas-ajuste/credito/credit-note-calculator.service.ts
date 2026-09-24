import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { ConceptoNotaCredito } from '../enums/notas-ajuste.enum';
import { ItemNotaAjuste } from '../entities/items-notas-ajuste.entity';
import { CreateNotaCreditoV2Dto, NotaCreditoV2ItemDto } from '../dto/create-nota-credito-v2.dto';
import { DisponibilidadNotaService } from '../disponibilidad/disponibilidad-nota.service';
import { MathUtil } from 'src/common/utils/math.util';

export interface CalculatedCreditNote {
  lines: Partial<ItemNotaAjuste>[];
  subtotal: number;
  iva: number;
  total: number;
}

const CONCEPTOS_DESCUENTO = [
  ConceptoNotaCredito.REBAJA_DESCUENTO,
  ConceptoNotaCredito.DESCUENTO_PRONTO_PAGO,
  ConceptoNotaCredito.DESCUENTO_VOLUMEN,
];

/**
 * Calculadora de Nota Crédito por concepto DIAN (guía NC 2026 §4).
 * El backend es fuente de verdad: recibe SOLO el input del concepto y
 * devuelve las líneas en las 5 capas (snapshot/input/resultado/impuestos).
 *
 * Resultado por concepto (lo que se acredita al cliente):
 * - '1' Devolución: qty Devuelta × precioOriginal + IVA.
 * - '2' Anulación: 100% de cada línea (qty original × precioOriginal + IVA).
 * - '3'/'5'/'6' Descuento: D + IVA(D). subtotal=D, valorDescuento=0
 *   (el descuento ES el crédito; el input queda en descuentoTasa/ValorInput).
 * - '4' Ajuste precio: (precioOriginal − precioNuevo) × qty + IVA.
 *   valorUnitario = diferencia (nunca precioNuevo como total).
 */
@Injectable()
export class CreditNoteCalculator {
  constructor(
    @InjectRepository(FacturasVenta)
    private readonly facturaRepository: Repository<FacturasVenta>,
    private readonly disponibilidadService: DisponibilidadNotaService,
  ) {}

  async calculate(dto: CreateNotaCreditoV2Dto): Promise<CalculatedCreditNote> {
    const factura = await this.facturaRepository.findOne({
      where: { id: dto.facturaOriginalId },
      relations: ['items'],
    });
    if (!factura) {
      throw new NotFoundException('Factura original no encontrada');
    }
    if (factura.esElectronica() && factura.status !== InvoiceStatus.ACCEPTED) {
      throw new BadRequestException(
        'Solo se pueden crear notas para facturas electrónicas aceptadas por DIAN',
      );
    }
    if (!factura.esElectronica() && factura.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Solo se pueden crear notas para facturas estándar emitidas');
    }
    if (!factura.items?.length) {
      throw new BadRequestException('La factura no tiene ítems para ajustar');
    }

    const disp = await this.disponibilidadService.calcular(factura.id);
    if (disp.documento.bloqueada) {
      throw new BadRequestException(
        disp.documento.anulada
          ? 'La factura ya fue anulada: no admite más notas crédito'
          : 'La factura no tiene saldo disponible para acreditar',
      );
    }
    const dispPorArticulo = new Map(disp.lineas.map((l) => [l.articuloId, l]));
    const fuentePorArticulo = new Map<string, any>();
    for (const fi of factura.items) {
      if (!fuentePorArticulo.has(fi.articuloId)) {
        fuentePorArticulo.set(fi.articuloId, fi);
      }
    }

    let lines: Partial<ItemNotaAjuste>[];
    switch (dto.concepto) {
      case ConceptoNotaCredito.DEVOLUCION_PARCIAL:
        lines = this.devolucion(dto.items ?? [], fuentePorArticulo, dispPorArticulo);
        break;
      case ConceptoNotaCredito.ANULACION:
        lines = this.anulacion(dto.items ?? [], factura.items);
        break;
      case ConceptoNotaCredito.REBAJA_DESCUENTO:
      case ConceptoNotaCredito.DESCUENTO_PRONTO_PAGO:
      case ConceptoNotaCredito.DESCUENTO_VOLUMEN:
        lines = this.descuento(dto, fuentePorArticulo, dispPorArticulo, factura.items);
        break;
      case ConceptoNotaCredito.AJUSTE_PRECIO:
        lines = this.ajustePrecio(dto.items ?? [], fuentePorArticulo, dispPorArticulo);
        break;
      default:
        throw new BadRequestException(`Concepto DIAN no soportado: ${dto.concepto}`);
    }

    if (!lines.length) {
      throw new BadRequestException('La nota crédito no tiene líneas para acreditar');
    }

    let subtotal = 0;
    let iva = 0;
    let total = 0;
    for (const l of lines) {
      subtotal = MathUtil.sum(subtotal, Number(l.subtotal));
      iva = MathUtil.sum(iva, Number(l.valorIVA));
      total = MathUtil.sum(total, Number(l.total));
    }

    // No sobreacreditar el documento (fuente de verdad a nivel documento).
    if (total > disp.documento.saldoDisponible) {
      throw new BadRequestException(
        `El total de la nota ($${total}) excede el saldo disponible de la factura ($${disp.documento.saldoDisponible})`,
      );
    }

    return { lines, subtotal, iva, total };
  }

  // ========== Estrategia 1: Devolución parcial (solo cantidad) ==========

  private devolucion(
    items: NotaCreditoV2ItemDto[],
    fuente: Map<string, any>,
    disp: Map<string, any>,
  ): Partial<ItemNotaAjuste>[] {
    this.exigirItems(items, 'la devolución parcial requiere al menos una línea con cantidad');
    this.sinDuplicados(items);
    return items.map((it) => {
      const f = this.fuente(it.articuloId, fuente);
      const d = disp.get(it.articuloId);
      const qty = Number(it.cantidad ?? 0);
      if (!(qty > 0)) {
        throw new BadRequestException(`Cantidad a devolver debe ser mayor a 0 (${it.articuloId})`);
      }
      const disponible = d?.cantidadDisponible ?? Number(f.quantity);
      if (qty > disponible) {
        throw new BadRequestException(
          `Cantidad a devolver (${qty}) excede la disponible (${disponible})`,
        );
      }
      const precio = Number(f.unitPrice);
      const tasa = Number(f.iva ?? 0);
      const base = MathUtil.mul(precio, qty);
      const ivaVal = MathUtil.percentage(base, tasa);
      return this.linea(f, {
        cantidad: qty,
        valorUnitario: precio,
        descuento: 0,
        valorDescuento: 0,
        subtotal: base,
        valorIVA: ivaVal,
        total: MathUtil.sum(base, ivaVal),
        cantidadInput: qty,
        precioNuevo: null,
        descuentoTasaInput: null,
        descuentoValorInput: null,
        detalleCalculo: { base, tasaIva: tasa, iva: ivaVal },
        afectaInventario: true,
      });
    });
  }

  // ========== Estrategia 2: Anulación (100%, sin edición) ==========

  private anulacion(items: NotaCreditoV2ItemDto[], facturaItems: any[]): Partial<ItemNotaAjuste>[] {
    if (items.length > 0) {
      throw new BadRequestException('La anulación acredita el 100%: no admite líneas editadas');
    }
    return facturaItems.map((f) => {
      const qty = Number(f.quantity);
      const precio = Number(f.unitPrice);
      const tasa = Number(f.iva ?? 0);
      const base = MathUtil.mul(precio, qty);
      const ivaVal = MathUtil.percentage(base, tasa);
      return this.linea(f, {
        cantidad: qty,
        valorUnitario: precio,
        descuento: 0,
        valorDescuento: 0,
        subtotal: base,
        valorIVA: ivaVal,
        total: MathUtil.sum(base, ivaVal),
        cantidadInput: null,
        precioNuevo: null,
        descuentoTasaInput: null,
        descuentoValorInput: null,
        detalleCalculo: { base, tasaIva: tasa, iva: ivaVal },
        afectaInventario: true,
      });
    });
  }

  // ========== Estrategia 3: Descuento 3/5/6 (solo descuento, sin qty) ==========

  private descuento(
    dto: CreateNotaCreditoV2Dto,
    fuente: Map<string, any>,
    disp: Map<string, any>,
    facturaItems: any[],
  ): Partial<ItemNotaAjuste>[] {
    let items = dto.items ?? [];
    if (dto.aplicarDescuentoATodo) {
      const tasa = Number(dto.descuentoTasaGlobal ?? 0);
      const valor = Number(dto.descuentoValorGlobal ?? 0);
      if (!(tasa > 0) && !(valor > 0)) {
        throw new BadRequestException(
          'Aplicar a todo requiere descuentoTasaGlobal o descuentoValorGlobal mayor a 0',
        );
      }
      if (tasa > 0) {
        items = facturaItems.map((f) => ({ articuloId: f.articuloId, descuentoTasa: tasa }));
      } else {
        // El valor global se prorratea por base neta de cada línea.
        const bases = facturaItems.map((f) =>
          MathUtil.sub(Number(f.subtotal), Number(f.valor_discount ?? 0)),
        );
        const totalBase = bases.reduce((a, b) => MathUtil.sum(a, b), 0);
        if (!(totalBase > 0)) {
          throw new BadRequestException('Sin base para prorratear el descuento global');
        }
        // La última línea absorbe el redondeo para que Σ = valor global.
        let acumulado = 0;
        items = facturaItems.map((f, i) => {
          const esUltima = i === facturaItems.length - 1;
          const d = esUltima
            ? MathUtil.sub(valor, acumulado)
            : MathUtil.round((valor * bases[i]) / totalBase);
          acumulado = MathUtil.sum(acumulado, d);
          return { articuloId: f.articuloId, descuentoValor: d };
        });
      }
    }
    this.exigirItems(items, 'el descuento requiere al menos una línea');
    this.sinDuplicados(items);
    return items.map((it) => {
      const f = this.fuente(it.articuloId, fuente);
      const d = disp.get(it.articuloId);
      const tasa = Number(it.descuentoTasa ?? 0);
      let valor = Number(it.descuentoValor ?? 0);
      if (tasa > 0 && valor > 0) {
        throw new BadRequestException('Use tasa (%) o valor ($) por línea, no ambos');
      }
      if (tasa > 100) {
        throw new BadRequestException('La tasa de descuento no puede superar 100%');
      }
      // Base neta (descontando el dto. propio de la factura) para coherencia
      // con descuentoDisponible.
      const baseNeta = MathUtil.sub(Number(f.subtotal), Number(f.valor_discount ?? 0));
      if (tasa > 0) {
        valor = MathUtil.percentage(baseNeta, tasa);
      }
      if (!(valor > 0)) {
        throw new BadRequestException(`Descuento debe ser mayor a 0 (${it.articuloId})`);
      }
      const disponible = d?.descuentoDisponible ?? baseNeta;
      if (valor > disponible) {
        throw new BadRequestException(
          `Descuento ($${valor}) excede el disponible ($${disponible})`,
        );
      }
      const tasaIva = Number(f.iva ?? 0);
      const ivaVal = MathUtil.percentage(valor, tasaIva);
      return this.linea(f, {
        cantidad: Number(f.quantity),
        valorUnitario: Number(f.unitPrice),
        descuento: tasa,
        valorDescuento: 0,
        subtotal: valor,
        valorIVA: ivaVal,
        total: MathUtil.sum(valor, ivaVal),
        cantidadInput: null,
        precioNuevo: null,
        descuentoTasaInput: tasa > 0 ? tasa : null,
        descuentoValorInput: valor,
        detalleCalculo: { base: valor, tasaIva, iva: ivaVal },
        afectaInventario: false,
      });
    });
  }

  // ========== Estrategia 4: Ajuste de precio (solo precio nuevo) ==========

  private ajustePrecio(
    items: NotaCreditoV2ItemDto[],
    fuente: Map<string, any>,
    disp: Map<string, any>,
  ): Partial<ItemNotaAjuste>[] {
    this.exigirItems(items, 'el ajuste de precio requiere al menos una línea con precio nuevo');
    this.sinDuplicados(items);
    return items.map((it) => {
      const f = this.fuente(it.articuloId, fuente);
      const d = disp.get(it.articuloId);
      const precioOriginal = Number(f.unitPrice);
      const precioNuevo = Number(it.precioNuevo ?? NaN);
      if (!Number.isFinite(precioNuevo) || precioNuevo < 0) {
        throw new BadRequestException(`Precio nuevo inválido (${it.articuloId})`);
      }
      if (precioNuevo >= precioOriginal) {
        throw new BadRequestException(
          `Precio nuevo ($${precioNuevo}) debe ser menor al original ($${precioOriginal})`,
        );
      }
      const qty = d?.cantidadDisponible ?? Number(f.quantity);
      if (!(qty > 0)) {
        throw new BadRequestException(`Sin cantidad disponible para ajustar (${it.articuloId})`);
      }
      // difference = original − nuevo; el backend acredita la diferencia,
      // nunca el precio nuevo como total.
      const diferencia = MathUtil.sub(precioOriginal, precioNuevo);
      const base = MathUtil.mul(diferencia, qty);
      const tasa = Number(f.iva ?? 0);
      const ivaVal = MathUtil.percentage(base, tasa);
      return this.linea(f, {
        cantidad: qty,
        valorUnitario: diferencia,
        descuento: 0,
        valorDescuento: 0,
        subtotal: base,
        valorIVA: ivaVal,
        total: MathUtil.sum(base, ivaVal),
        cantidadInput: null,
        precioNuevo,
        descuentoTasaInput: null,
        descuentoValorInput: null,
        detalleCalculo: {
          base,
          tasaIva: tasa,
          iva: ivaVal,
          info: { precioOriginal, precioNuevo, diferencia },
        },
        afectaInventario: false,
      });
    });
  }

  // ========== Helpers ==========

  private linea(fuente: any, calc: Partial<ItemNotaAjuste>): Partial<ItemNotaAjuste> {
    return {
      articuloId: fuente.articuloId,
      impuestoId: fuente.impuestoId ?? null,
      porcentajeIVA: Number(fuente.iva ?? 0),
      cantidadOriginal: Number(fuente.quantity),
      precioOriginal: Number(fuente.unitPrice),
      subtotalOriginal: Number(fuente.subtotal),
      valorDescuentoOriginal: Number(fuente.valor_discount ?? 0),
      valorIVAOriginal: Number(fuente.valor_iva ?? 0),
      totalOriginal: Number(fuente.total),
      ...calc,
    };
  }

  private fuente(articuloId: string, fuente: Map<string, any>): any {
    const f = fuente.get(articuloId);
    if (!f) {
      throw new BadRequestException(
        `El artículo no pertenece a la factura original (${articuloId})`,
      );
    }
    return f;
  }

  private exigirItems(items: NotaCreditoV2ItemDto[], mensaje: string): void {
    if (!items.length) {
      throw new BadRequestException(mensaje);
    }
  }

  private sinDuplicados(items: NotaCreditoV2ItemDto[]): void {
    const vistos = new Set<string>();
    for (const it of items) {
      if (vistos.has(it.articuloId)) {
        throw new BadRequestException(
          `Artículo duplicado en la nota (${it.articuloId}): use una línea por artículo`,
        );
      }
      vistos.add(it.articuloId);
    }
  }
}
