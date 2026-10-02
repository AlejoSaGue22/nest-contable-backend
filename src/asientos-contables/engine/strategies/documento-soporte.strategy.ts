import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner, DataSource, In } from 'typeorm';
import { IContabilizacionStrategy } from '../contabilizacion-strategy.interface';
import { DefinicionAsientoDto, DefinicionDetalleAsientoDto } from '../../dto/definicion-asiento.dto';
import { AsientosContablesService } from '../../asientos-contables.service';
import { DocumentoSoporte } from 'src/documentos-soportes/entities/documento-soporte.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';

/**
 * Estrategia de contabilización del Documento Soporte (estándar o electrónico).
 * Reglas idénticas a la factura de compra:
 * - Débito: gasto/inventario por categoría + IVA descontable.
 * - Crédito: CxP proveedor (2205) o gastos por pagar (2335) por el 100% del total.
 * - Descuento obtenido: 421015.
 */
@Injectable()
export class DocumentoSoporteStrategy implements IContabilizacionStrategy {
  readonly tipoDocumento = 'DOCUMENTO_SOPORTE';

  constructor(
    private readonly dataSource: DataSource,
    private readonly asientosService: AsientosContablesService,
    private readonly parametrizacionService: ParametrizacionContableService,
  ) { }

  async generarDefinicion(documentoId: string, queryRunner?: QueryRunner): Promise<DefinicionAsientoDto> {
    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;

    const documento = await manager.findOne(DocumentoSoporte, {
      where: { id: documentoId },
      relations: ['proveedor', 'items', 'cuentaBancaria'],
    });

    if (!documento) throw new NotFoundException(`Documento soporte con ID ${documentoId} no encontrado`);

    const detalles: DefinicionDetalleAsientoDto[] = [];
    const terceroNombre = documento.proveedor
      ? (documento.proveedor.razonSocial || `${documento.proveedor.nombre || ''} ${documento.proveedor.apellido || ''}`.trim())
      : '';

    // 2. Débito: Cuentas de gasto agrupadas por artículo e IVA descontable
    const gastosAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();
    const ivaAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();

    for (const item of documento.items) {
      let cuentaGasto: CuentaContable | null = null;
      let impuestoId = item.impuestoId;
      let impuestoRel = item.impuestoRel;

      if (item.articuloId) {
        const articulo = await manager.findOne(Articulo, {
          where: { id: item.articuloId },
          relations: [
            'categoriaArticulo',
            'categoriaArticulo.cuentaInventario',
            'categoriaArticulo.cuentaCosto',
            'categoriaArticulo.cuentaPrincipal',
            'impuestoRel',
            'impuestoRel.cuentaCompras',
          ],
        });

        const categoria = articulo?.categoriaArticulo;
        if (!categoria) {
          throw new Error(`No se pudo determinar la categoría para el artículo del ítem con ID ${item.id}`);
        }

        if (articulo.isInventariable && categoria.cuentaInventario) {
          cuentaGasto = categoria.cuentaInventario;
        } else if (categoria.cuentaCosto) {
          cuentaGasto = categoria.cuentaCosto;
        } else if (categoria.cuentaInventario) {
          cuentaGasto = categoria.cuentaInventario;
        } else if (categoria.cuentaPrincipal) {
          cuentaGasto = categoria.cuentaPrincipal;
        }

        if (!cuentaGasto) {
          throw new Error(`No se pudo determinar la cuenta contable para el ítem con ID ${item.id}`);
        }
        if (!impuestoId) impuestoId = articulo.impuestoId;
        if (!impuestoRel) impuestoRel = articulo.impuestoRel;
      } else if (item.cuentaContableId) {
        cuentaGasto = item.cuentaContable || await manager.findOne(CuentaContable, {
          where: { id: item.cuentaContableId }
        });
      }

      if (!cuentaGasto) {
        throw new Error(`No se pudo determinar la cuenta contable para el ítem con ID ${item.id}`);
      }

      const acumGasto = gastosAgrupados.get(cuentaGasto.id)?.valor ?? 0;
      gastosAgrupados.set(cuentaGasto.id, {
        valor: acumGasto + Number(item.valorSubtotal),
        cuenta: cuentaGasto,
      });

      const valorIva = Number(item.valorIva) || 0;
      if (valorIva > 0) {
        let cuentaIva: CuentaContable;
        const cuentaIvaPorcentaje = await this.asientosService.obtenerCuentaImpuesto({
          impuestoId: impuestoId,
          tarifa: item.porcentajeIva || 0,
          tipo: 'IVA',
          operacion: 'compras',
        });

        if (cuentaIvaPorcentaje) {
          cuentaIva = cuentaIvaPorcentaje;
        } else if (impuestoRel?.cuentaCompras) {
          cuentaIva = impuestoRel.cuentaCompras;
        } else {
          cuentaIva = await this.asientosService.obtenerCuentaPorCodigo('1355');
        }

        const acumIva = ivaAgrupados.get(cuentaIva.id)?.valor ?? 0;
        ivaAgrupados.set(cuentaIva.id, {
          valor: acumIva + valorIva,
          cuenta: cuentaIva,
        });
      }
    }

    for (const [_, item] of gastosAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: item.valor,
        credito: 0,
        concepto: `Gasto - ${item.cuenta.nombre}`,
        terceroId: documento.proveedorId,
        terceroNombre,
      });
    }

    for (const [_, item] of ivaAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: item.valor,
        credito: 0,
        concepto: 'IVA descontable en documento soporte',
        terceroId: documento.proveedorId,
        terceroNombre,
      });
    }

    // 3. Crédito: Proveedores/Gastos por pagar por el 100% del total
    let codigoCxP = '2205';
    if (gastosAgrupados.size > 0) {
      const cuentasInvolucradas = await manager.find(CuentaContable, {
        where: { id: In(Array.from(gastosAgrupados.keys())) },
      });
      if (cuentasInvolucradas.some((c) => c.codigo.startsWith('5'))) {
        codigoCxP = '2335';
      }
    }

    const referenciaDoc = documento.numero || documento.numeroDian || 'Borrador';
    const descCredito = `${codigoCxP === '2335' ? 'Gasto por pagar' : 'Deuda con proveedor'} - Documento soporte: ${referenciaDoc}`;

    let cuentaCredito: CuentaContable;
    let proveedor: Proveedor | null = documento.proveedor;
    if (!proveedor || !proveedor.cuentaContableId) {
      proveedor = await manager.findOne(Proveedor, {
        where: { id: documento.proveedorId },
        relations: ['cuentaContable'],
      });
    }
    if (proveedor?.cuentaContable) {
      cuentaCredito = proveedor.cuentaContable;
    } else {
      const config = await this.parametrizacionService.getConfiguracion();
      if (config.cuentaPagarProveedoresId) {
        const temp = await manager.findOne(CuentaContable, {
          where: { id: config.cuentaPagarProveedoresId },
        });
        cuentaCredito = temp || (await this.asientosService.obtenerCuentaPorCodigo(codigoCxP));
      } else {
        cuentaCredito = await this.asientosService.obtenerCuentaPorCodigo(codigoCxP);
      }
    }

    const totalDocumento = Number(documento.total);
    if (totalDocumento > 0) {
      detalles.push({
        cuentaId: cuentaCredito.id,
        cuentaCodigo: cuentaCredito.codigo,
        cuentaNombre: cuentaCredito.nombre,
        debito: 0,
        credito: totalDocumento,
        concepto: descCredito,
        terceroId: documento.proveedorId,
        terceroNombre,
      });
    }

    const descuento = Number(documento.descuento) || 0;
    if (descuento > 0) {
      const cuentaDescuento = await this.asientosService.obtenerCuentaPorCodigo('421015');
      detalles.push({
        cuentaId: cuentaDescuento.id,
        cuentaCodigo: cuentaDescuento.codigo,
        cuentaNombre: cuentaDescuento.nombre,
        debito: 0,
        credito: descuento,
        concepto: 'Descuento obtenido en documento soporte',
        terceroId: documento.proveedorId,
        terceroNombre,
      });
    }

    const totalDebito = detalles.reduce((sum, d) => sum + d.debito, 0);
    const totalCredito = detalles.reduce((sum, d) => sum + d.credito, 0);
    const diferencia = Math.abs(totalDebito - totalCredito);
    const estaBalanceado = diferencia <= 0.01;

    return {
      tipo: 'GASTO',
      fecha: documento.fecha || new Date(),
      referencia: referenciaDoc,
      descripcion: `Asiento automático - Documento soporte ${referenciaDoc}`,
      detalles,
      totalDebito,
      totalCredito,
      estaBalanceado,
      diferencia,
    };
  }
}
