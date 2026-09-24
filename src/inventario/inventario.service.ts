import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  DocumentoInventario,
  MovimientoInventario,
  TipoMovimientoInventario,
} from './entities/movimiento-inventario.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { MathUtil } from 'src/common/utils/math.util';

interface LineaInventario {
  articuloId: string | null | undefined;
  cantidad: number;
}

/**
 * Kardex mínimo (v1, cantidades):
 * - SALIDA al emitir/aceptar factura de venta (solo inventariables).
 * - ENTRADA al registrar factura de compra (solo inventariables).
 * - ENTRADA al aceptar NC por devolución (1) / anulación (2).
 * - AJUSTE manual (cargas iniciales, conteos) + carga bulk de saldos iniciales.
 * - Reversa al anular (espejo del movimiento original, por artículo).
 *
 * Reglas v1: sin bloqueo por stock negativo (se avisa en log),
 * sin costo promedio (solo cantidades + auditoría).
 * Todo movimiento es idempotente por (documentoTipo, documentoId).
 */
@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepository: Repository<MovimientoInventario>,
    @InjectRepository(Articulo)
    private readonly articuloRepository: Repository<Articulo>,
  ) {}

  /** SALIDA por venta emitida/aceptada. Idempotente por factura. */
  async registrarSalidasVenta(
    manager: EntityManager,
    facturaId: string,
    lineas: LineaInventario[],
    userId: string,
  ): Promise<number> {
    if (await this.yaRegistrado(manager, DocumentoInventario.FACTURA_VENTA, facturaId)) {
      return 0;
    }
    let movs = 0;
    for (const l of lineas) {
      if (!(Number(l.cantidad) > 0)) continue;
      if (await this.mover(manager, l.articuloId, TipoMovimientoInventario.SALIDA, Number(l.cantidad),
        DocumentoInventario.FACTURA_VENTA, facturaId, `Venta ${facturaId}`, userId)) {
        movs++;
      }
    }
    return movs;
  }

  /** ENTRADA por NC aceptada/emitida (solo conceptos con afectaInventario). */
  async registrarEntradasNC(
    manager: EntityManager,
    notaId: string,
    lineas: Array<LineaInventario & { afectaInventario?: boolean }>,
    numeroCompleto: string,
    userId: string,
  ): Promise<number> {
    if (await this.yaRegistrado(manager, DocumentoInventario.NOTA_CREDITO, notaId)) {
      return 0;
    }
    let movs = 0;
    for (const l of lineas) {
      if (!l.afectaInventario) continue;
      if (!(Number(l.cantidad) > 0)) continue;
      if (await this.mover(manager, l.articuloId, TipoMovimientoInventario.ENTRADA, Number(l.cantidad),
        DocumentoInventario.NOTA_CREDITO, notaId, `Devolución NC ${numeroCompleto}`, userId)) {
        movs++;
      }
    }
    return movs;
  }

  /** ENTRADA por compra registrada (solo inventariables). Idempotente por factura. */
  async registrarEntradasCompra(
    manager: EntityManager,
    facturaId: string,
    lineas: LineaInventario[],
    numero: string,
    userId: string,
  ): Promise<number> {
    if (await this.yaRegistrado(manager, DocumentoInventario.FACTURA_COMPRA, facturaId)) {
      return 0;
    }
    let movs = 0;
    for (const l of lineas) {
      if (!l.articuloId) continue; // líneas solo-contables (cuentaContableId) no mueven stock
      if (!(Number(l.cantidad) > 0)) continue;
      if (await this.mover(manager, l.articuloId, TipoMovimientoInventario.ENTRADA, Number(l.cantidad),
        DocumentoInventario.FACTURA_COMPRA, facturaId, `Compra ${numero}`, userId)) {
        movs++;
      }
    }
    return movs;
  }

  /**
   * Reversa de los movimientos de un documento (anulación):
   * cada movimiento original genera su espejo (ENTRADA↔SALIDA),
   * marcado con documentoId `:reversa`. Idempotente por artículo.
   */
  async revertirDocumento(
    manager: EntityManager,
    documentoTipo: DocumentoInventario,
    documentoId: string,
    motivo: string,
    userId: string,
  ): Promise<number> {
    const originales = await manager.find(MovimientoInventario, {
      where: { documentoTipo, documentoId },
    });
    let movs = 0;
    for (const o of originales) {
      if (String(o.documentoId).endsWith(':reversa')) continue;
      const espejo = o.tipo === TipoMovimientoInventario.ENTRADA
        ? TipoMovimientoInventario.SALIDA
        : TipoMovimientoInventario.ENTRADA;
      const existe = await manager.findOne(MovimientoInventario, {
        where: {
          documentoTipo,
          documentoId: `${documentoId}:reversa`,
          articuloId: o.articuloId,
          tipo: espejo,
        },
      });
      if (existe) continue;
      if (await this.mover(manager, o.articuloId, espejo, Number(o.cantidad),
        documentoTipo, `${documentoId}:reversa`, motivo, userId)) {
        movs++;
      }
    }
    return movs;
  }

  /**
   * Carga bulk de saldos iniciales: cada item fija el stock deseado
   * (delta = deseado − actual) con movimiento AJUSTE_MANUAL.
   * Solo aplica si el artículo no tiene movimientos previos
   * (si ya tiene kardex, use ajuste manual individual).
   */
  async cargarSaldosIniciales(
    items: Array<{ articuloId: string; cantidad: number }>,
    userId: string,
  ): Promise<Array<{ articuloId: string; codigo: string; anterior: number; nuevo: number; estado: string }>> {
    const manager = this.movimientoRepository.manager;
    const resultado: Array<{ articuloId: string; codigo: string; anterior: number; nuevo: number; estado: string }> = [];
    for (const it of items ?? []) {
      const deseado = Number(it.cantidad);
      if (!it.articuloId || !(deseado >= 0)) {
        resultado.push({ articuloId: it.articuloId, codigo: '', anterior: 0, nuevo: 0, estado: 'omitido: cantidad inválida' });
        continue;
      }
      const articulo = await manager.findOne(Articulo, { where: { id: it.articuloId } });
      if (!articulo) {
        resultado.push({ articuloId: it.articuloId, codigo: '', anterior: 0, nuevo: 0, estado: 'omitido: artículo no existe' });
        continue;
      }
      if (!articulo.isInventariable) {
        resultado.push({ articuloId: it.articuloId, codigo: articulo.codigo, anterior: 0, nuevo: 0, estado: 'omitido: no inventariable' });
        continue;
      }
      const previos = await manager.count(MovimientoInventario, { where: { articuloId: it.articuloId } });
      if (previos > 0) {
        resultado.push({
          articuloId: it.articuloId, codigo: articulo.codigo,
          anterior: Number((articulo as any).stock ?? 0), nuevo: Number((articulo as any).stock ?? 0),
          estado: 'omitido: ya tiene kardex (use ajuste manual)',
        });
        continue;
      }
      const anterior = Number((articulo as any).stock ?? 0);
      const delta = MathUtil.sub(deseado, anterior);
      if (delta === 0) {
        resultado.push({ articuloId: it.articuloId, codigo: articulo.codigo, anterior, nuevo: anterior, estado: 'sin cambios' });
        continue;
      }
      const mov = await this.mover(manager, it.articuloId,
        delta > 0 ? TipoMovimientoInventario.ENTRADA : TipoMovimientoInventario.SALIDA,
        Math.abs(delta), DocumentoInventario.AJUSTE_MANUAL,
        `saldo-inicial-${it.articuloId}`, 'Saldo inicial', userId);
      resultado.push({
        articuloId: it.articuloId, codigo: articulo.codigo, anterior, nuevo: deseado,
        estado: mov ? 'cargado' : 'omitido',
      });
    }
    return resultado;
  }

  /** Ajuste manual (carga inicial, conteo). cantidad + entra, − sale. */
  async ajusteManual(
    articuloId: string,
    cantidad: number,
    motivo: string,
    userId: string,
  ): Promise<MovimientoInventario> {
    if (!(Number(cantidad) !== 0)) {
      throw new BadRequestException('La cantidad del ajuste debe ser distinta de 0');
    }
    const tipo = Number(cantidad) > 0 ? TipoMovimientoInventario.ENTRADA : TipoMovimientoInventario.SALIDA;
    const mov = await this.mover(
      this.movimientoRepository.manager,
      articuloId,
      tipo,
      Math.abs(Number(cantidad)),
      DocumentoInventario.AJUSTE_MANUAL,
      `manual-${Date.now()}`,
      motivo || 'Ajuste manual',
      userId,
    );
    if (!mov) {
      throw new BadRequestException('El artículo no es inventariable');
    }
    return mov;
  }

  async obtenerStock(articuloId: string) {
    const articulo = await this.articuloRepository.findOne({ where: { id: articuloId } });
    if (!articulo) {
      throw new NotFoundException('Artículo no encontrado');
    }
    const movimientos = await this.movimientoRepository.find({
      where: { articuloId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return {
      articuloId: articulo.id,
      codigo: articulo.codigo,
      nombre: articulo.nombre,
      isInventariable: articulo.isInventariable,
      stock: Number((articulo as any).stock ?? 0),
      ultimosMovimientos: movimientos,
    };
  }

  private async yaRegistrado(
    manager: EntityManager,
    documentoTipo: DocumentoInventario,
    documentoId: string,
  ): Promise<boolean> {
    const count = await manager.count(MovimientoInventario, { where: { documentoTipo, documentoId } });
    return count > 0;
  }

  /** Mueve stock y deja auditoría. Retorna null si el artículo no es inventariable. */
  private async mover(
    manager: EntityManager,
    articuloId: string | null | undefined,
    tipo: TipoMovimientoInventario,
    cantidad: number,
    documentoTipo: DocumentoInventario,
    documentoId: string,
    motivo: string,
    userId: string,
  ): Promise<MovimientoInventario | null> {
    if (!articuloId) return null;
    const articulo = await manager.findOne(Articulo, { where: { id: articuloId } });
    if (!articulo) {
      this.logger.warn(`Inventario: artículo ${articuloId} no encontrado, se omite`);
      return null;
    }
    if (!articulo.isInventariable) return null;

    const stockActual = Number((articulo as any).stock ?? 0);
    const delta =
      tipo === TipoMovimientoInventario.SALIDA ? -Math.abs(cantidad) : Math.abs(cantidad);
    const nuevoStock = MathUtil.sum(stockActual, delta);
    if (nuevoStock < 0) {
      this.logger.warn(
        `Inventario: ${articulo.codigo} queda en negativo (${nuevoStock}). Cargue saldos iniciales con ajuste manual.`,
      );
    }
    await manager.update(Articulo, { id: articuloId }, { stock: nuevoStock } as any);

    const mov = manager.create(MovimientoInventario, {
      articuloId,
      tipo,
      cantidad: Math.abs(cantidad),
      documentoTipo,
      documentoId,
      saldoDespues: nuevoStock,
      motivo,
      createdById: userId,
    });
    return manager.save(MovimientoInventario, mov);
  }
}
