import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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

export interface AlertaNegativo {
  articuloId: string;
  codigo: string;
  saldoDespues: number;
}

export interface ResultadoKardex {
  movs: number;
  /** Artículos que quedaron en negativo (política: solo alertar, nunca bloquear). */
  negativos: AlertaNegativo[];
}

export interface AdvertenciaInventario {
  codigo: string;
  mensaje: string;
}

/**
 * Kardex mínimo (v1, cantidades):
 * - SALIDA al emitir/aceptar factura de venta (solo inventariables).
 * - ENTRADA al registrar factura de compra (solo inventariables).
 * - ENTRADA al aceptar NC de venta por devolución (1) / anulación (2).
 * - SALIDA al registrar NC de compra (devolución a proveedor).
 * - AJUSTE manual (cargas iniciales, conteos) + carga bulk de saldos iniciales.
 * - Reversa al anular (espejo del movimiento original, por artículo).
 *
 * Política de inventario: BLOQUEO en registro/emisión de documentos con
 * SALIDA (ventas + NC de compra) si no hay stock. Las reversas por anulación
 * y los ajustes manuales solo alertan (nunca dejan un documento a medias).
 * Sin costo promedio (solo cantidades + auditoría).
>>>>>>> fd653afbc4c13d933b49f1a7364aaa1f61af5ebc
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
    private readonly dataSource: DataSource,
  ) { }

  /** SALIDA por venta emitida/aceptada. Idempotente por factura. */
  async registrarSalidasVenta(
    manager: EntityManager,
    facturaId: string,
    lineas: LineaInventario[],
    userId: string,
  ): Promise<ResultadoKardex> {
    if (await this.yaRegistrado(manager, DocumentoInventario.FACTURA_VENTA, facturaId)) {
      return { movs: 0, negativos: [] };
    }
    let movs = 0;
    const negativos: AlertaNegativo[] = [];
    for (const l of lineas) {
      if (!(Number(l.cantidad) > 0)) continue;
      const r = await this.mover(manager, l.articuloId, TipoMovimientoInventario.SALIDA, Number(l.cantidad),
        DocumentoInventario.FACTURA_VENTA, facturaId, `Venta ${facturaId}`, userId);
      if (r) {
        movs++;
        if (Number(r.mov.saldoDespues) < 0) {
          negativos.push({ articuloId: r.mov.articuloId, codigo: r.codigo, saldoDespues: Number(r.mov.saldoDespues) });
        }
      }
    }
    return { movs, negativos };
  }

  /** ENTRADA por NC aceptada/emitida (solo conceptos con afectaInventario). */
  async registrarEntradasNC(
    manager: EntityManager,
    notaId: string,
    lineas: Array<LineaInventario & { afectaInventario?: boolean }>,
    numeroCompleto: string,
    userId: string,
  ): Promise<ResultadoKardex> {
    if (await this.yaRegistrado(manager, DocumentoInventario.NOTA_CREDITO, notaId)) {
      return { movs: 0, negativos: [] };
    }
    let movs = 0;
    const negativos: AlertaNegativo[] = [];
    for (const l of lineas) {
      if (!l.afectaInventario) continue;
      if (!(Number(l.cantidad) > 0)) continue;
      const r = await this.mover(manager, l.articuloId, TipoMovimientoInventario.ENTRADA, Number(l.cantidad),
        DocumentoInventario.NOTA_CREDITO, notaId, `Devolución NC ${numeroCompleto}`, userId);
      if (r) {
        movs++;
        if (Number(r.mov.saldoDespues) < 0) {
          negativos.push({ articuloId: r.mov.articuloId, codigo: r.codigo, saldoDespues: Number(r.mov.saldoDespues) });
        }
      }
    }
    return { movs, negativos };
  }

  /** ENTRADA por compra registrada (solo inventariables). Idempotente por factura. */
  async registrarEntradasCompra(
    manager: EntityManager,
    facturaId: string,
    lineas: LineaInventario[],
    numero: string,
    userId: string,
  ): Promise<ResultadoKardex> {
    if (await this.yaRegistrado(manager, DocumentoInventario.FACTURA_COMPRA, facturaId)) {
      return { movs: 0, negativos: [] };
    }
    let movs = 0;
    const negativos: AlertaNegativo[] = [];
    for (const l of lineas) {
      if (!l.articuloId) continue; // líneas solo-contables (cuentaContableId) no mueven stock
      if (!(Number(l.cantidad) > 0)) continue;
      const r = await this.mover(manager, l.articuloId, TipoMovimientoInventario.ENTRADA, Number(l.cantidad),
        DocumentoInventario.FACTURA_COMPRA, facturaId, `Compra ${numero}`, userId);
      if (r) {
        movs++;
        if (Number(r.mov.saldoDespues) < 0) {
          negativos.push({ articuloId: r.mov.articuloId, codigo: r.codigo, saldoDespues: Number(r.mov.saldoDespues) });
        }
      }
    }
    return { movs, negativos };
  }

  /** SALIDA por NC de compra registrada (devolución a proveedor). Idempotente. */
  async registrarSalidasNCCompra(
    manager: EntityManager,
    notaId: string,
    lineas: LineaInventario[],
    numeroCompleto: string,
    userId: string,
  ): Promise<ResultadoKardex> {
    if (await this.yaRegistrado(manager, DocumentoInventario.NOTA_CREDITO_COMPRA, notaId)) {
      return { movs: 0, negativos: [] };
    }
    let movs = 0;
    const negativos: AlertaNegativo[] = [];
    for (const l of lineas) {
      if (!l.articuloId) continue;
      if (!(Number(l.cantidad) > 0)) continue;
      const r = await this.mover(manager, l.articuloId, TipoMovimientoInventario.SALIDA, Number(l.cantidad),
        DocumentoInventario.NOTA_CREDITO_COMPRA, notaId, `Devolución proveedor NC ${numeroCompleto}`, userId);
      if (r) {
        movs++;
        if (Number(r.mov.saldoDespues) < 0) {
          negativos.push({ articuloId: r.mov.articuloId, codigo: r.codigo, saldoDespues: Number(r.mov.saldoDespues) });
        }
      }
    }
    return { movs, negativos };
  }

  /** ENTRADA por documento soporte registrado/emitido (solo inventariables). Idempotente. */
  async registrarEntradasDocumentoSoporte(
    manager: EntityManager,
    documentoId: string,
    lineas: LineaInventario[],
    numero: string,
    userId: string,
  ): Promise<ResultadoKardex> {
    if (await this.yaRegistrado(manager, DocumentoInventario.DOCUMENTO_SOPORTE, documentoId)) {
      return { movs: 0, negativos: [] };
    }
    let movs = 0;
    const negativos: AlertaNegativo[] = [];
    for (const l of lineas) {
      if (!l.articuloId) continue; // líneas solo-contables (cuentaContableId) no mueven stock
      if (!(Number(l.cantidad) > 0)) continue;
      const r = await this.mover(manager, l.articuloId, TipoMovimientoInventario.ENTRADA, Number(l.cantidad),
        DocumentoInventario.DOCUMENTO_SOPORTE, documentoId, `Documento soporte ${numero}`, userId);
      if (r) {
        movs++;
        if (Number(r.mov.saldoDespues) < 0) {
          negativos.push({ articuloId: r.mov.articuloId, codigo: r.codigo, saldoDespues: Number(r.mov.saldoDespues) });
        }
      }
    }
    return { movs, negativos };
  }

  /** SALIDA por NC a documento soporte registrada (devolución a proveedor). Idempotente. */
  async registrarSalidasNCSoporte(
    manager: EntityManager,
    notaId: string,
    lineas: LineaInventario[],
    numeroCompleto: string,
    userId: string,
  ): Promise<ResultadoKardex> {
    if (await this.yaRegistrado(manager, DocumentoInventario.NOTA_CREDITO_SOPORTE, notaId)) {
      return { movs: 0, negativos: [] };
    }
    let movs = 0;
    const negativos: AlertaNegativo[] = [];
    for (const l of lineas) {
      if (!l.articuloId) continue;
      if (!(Number(l.cantidad) > 0)) continue;
      const r = await this.mover(manager, l.articuloId, TipoMovimientoInventario.SALIDA, Number(l.cantidad),
        DocumentoInventario.NOTA_CREDITO_SOPORTE, notaId, `Devolución proveedor NC soporte ${numeroCompleto}`, userId);
      if (r) {
        movs++;
        if (Number(r.mov.saldoDespues) < 0) {
          negativos.push({ articuloId: r.mov.articuloId, codigo: r.codigo, saldoDespues: Number(r.mov.saldoDespues) });
        }
      }
    }
    return { movs, negativos };
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
  ): Promise<ResultadoKardex> {
    const originales = await manager.find(MovimientoInventario, {
      where: { documentoTipo, documentoId },
    });
    let movs = 0;
    const negativos: AlertaNegativo[] = [];
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
      const r = await this.mover(manager, o.articuloId, espejo, Number(o.cantidad),
        documentoTipo, `${documentoId}:reversa`, motivo, userId);
      if (r) {
        movs++;
        if (Number(r.mov.saldoDespues) < 0) {
          negativos.push({ articuloId: r.mov.articuloId, codigo: r.codigo, saldoDespues: Number(r.mov.saldoDespues) });
        }
      }
    }
    return { movs, negativos };
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

      const r = await this.mover(manager, it.articuloId,
        delta > 0 ? TipoMovimientoInventario.ENTRADA : TipoMovimientoInventario.SALIDA,
        Math.abs(delta), DocumentoInventario.AJUSTE_MANUAL,
        `saldo-inicial-${it.articuloId}`, 'Saldo inicial', userId);
      resultado.push({
        articuloId: it.articuloId, codigo: articulo.codigo, anterior, nuevo: deseado,
        estado: r ? 'cargado' : 'omitido',
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
    const r = await this.mover(
      this.movimientoRepository.manager,
      articuloId,
      tipo,
      Math.abs(Number(cantidad)),
      DocumentoInventario.AJUSTE_MANUAL,
      `manual-${Date.now()}`,
      motivo || 'Ajuste manual',
      userId,
    );
    if (!r) {
      throw new BadRequestException('El artículo no es inventariable');
    }
    return r.mov;
  }

  /**
   * BLOQUEO de inventario: valida que haya stock suficiente para las SALIDAs
   * del documento ANTES de registrar/emitir. Agrupa por artículo, omite
   * servicios y líneas sin artículo. Lanza BadRequestException detallando
   * los faltantes (el llamador hace rollback: nada se mueve a medias).
   */
  async validarDisponibilidad(
    manager: EntityManager,
    lineas: LineaInventario[],
    etiqueta: string,
  ): Promise<void> {
    const porArticulo = new Map<string, number>();
    for (const l of lineas ?? []) {
      if (!l.articuloId || !(Number(l.cantidad) > 0)) continue;
      porArticulo.set(l.articuloId, (porArticulo.get(l.articuloId) ?? 0) + Number(l.cantidad));
    }
    const faltantes: string[] = [];
    for (const [articuloId, requerida] of porArticulo) {
      const articulo = await manager.findOne(Articulo, {
        where: { id: articuloId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!articulo) {
        this.logger.warn(`Inventario: artículo ${articuloId} no encontrado, se omite en validación`);
        continue;
      }
      if (!articulo.isInventariable) continue;
      const disponible = Number((articulo as any).stock ?? 0);
      if (disponible < requerida) {
        faltantes.push(`${articulo.codigo} (requiere ${requerida}, disponible ${disponible})`);
      }
    }
    if (faltantes.length) {
      throw new BadRequestException(
        `Sin stock suficiente para ${etiqueta}: ${faltantes.join('; ')}. Cargue saldos iniciales o ajuste el documento.`,
      );
    }
  }

  /**
   * Solo-alertar (reversas por anulación y ajustes): convierte los negativos
   * del kardex en advertencias informativas para la respuesta del documento.
   */
  static alertasNegativo(kardex: ResultadoKardex | null | undefined): AdvertenciaInventario[] {
    return (kardex?.negativos ?? []).map((n) => ({
      codigo: n.codigo,
      mensaje: `Sin stock suficiente: ${n.codigo} quedó en ${n.saldoDespues}. Revise saldos iniciales.`,
    }));
  }

  /**
   * Conciliación kardex vs contabilidad (cuenta 1435 + hijas).
   * Solo lectura, sin dependencias a módulos contables (SQL directo para
   * evitar ciclos). La anulación contable es otro asiento, así que la suma
   * directa ya incluye las reversas.
   *
   * Límite honesto: el kardex no lleva costo; se valoriza a precio de lista
   * como aproximación. Diferencias esperables: H1/H2 históricos (compras
   * directas y NC de proveedor anteriores a este cierre), ajustes manuales
   * y redondeos.
   */
  async conciliacion() {
    const saldoContable = await this.dataSource.query(
      `SELECT COALESCE(SUM(d."debito" - d."credito"), 0) AS saldo
       FROM "asientos_detalles" d
       INNER JOIN "cuentas_contables" c ON c."id" = d."cuentaId"
       WHERE c."codigo" = '1435' OR c."codigo" LIKE '1435%'`,
    );
    const articulos = await this.dataSource.query(
      `SELECT a."id" AS "articuloId", a."codigo" AS codigo, a."nombre" AS nombre,
              a."stock" AS stock, a."precio" AS precio,
              (a."stock" * a."precio") AS valor,
              (SELECT COUNT(*) FROM "movimientos_inventario" m WHERE m."articuloId" = a."id") AS movimientos
       FROM "articulos" a
       WHERE a."isInventariable" = true AND a."deleteAt" IS NULL AND a."stock" <> 0
       ORDER BY a."codigo"`,
    );
    const valorKardex = articulos.reduce(
      (acc: number, a: any) => MathUtil.sum(acc, Number(a.valor ?? 0)),
      0,
    );
    const saldo1435 = Number(saldoContable?.[0]?.saldo ?? 0);
    return {
      cuenta: '1435',
      saldoContable1435: saldo1435,
      valorKardex,
      diferencia: MathUtil.sub(valorKardex, saldo1435),
      totalArticulos: articulos.length,
      articulosEnNegativo: articulos.filter((a: any) => Number(a.stock) < 0).length,
      nota: 'Valorización aproximada a precio de lista (el kardex no lleva costo promedio).',
      articulos,
    };
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
  ): Promise<{ mov: MovimientoInventario; codigo: string } | null> {
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
      // Base multi-empresa: el movimiento hereda la empresa del artículo.
      empresaId: (articulo as any).empresaId ?? null,
    });
    const guardado = await manager.save(MovimientoInventario, mov);
    return { mov: guardado, codigo: articulo.codigo };
  }
}
