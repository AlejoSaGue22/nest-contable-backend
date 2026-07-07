import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner, DataSource, In } from 'typeorm';
import { IContabilizacionStrategy } from '../contabilizacion-strategy.interface';
import { DefinicionAsientoDto, DefinicionDetalleAsientoDto } from '../../dto/definicion-asiento.dto';
import { AsientosContablesService } from '../../asientos-contables.service';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { FormaPago } from 'src/facturas-ventas/enums/factura-venta.enum';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';
import { AnticipoAplicacion, AplicacionEstado } from 'src/pagos/entities/anticipo-aplicacion.entity';
import { MathUtil } from 'src/common/utils/math.util';

@Injectable()
export class FacturaCompraStrategy implements IContabilizacionStrategy {
  readonly tipoDocumento = 'FACTURA_COMPRA';

  constructor(
    private readonly dataSource: DataSource,
    private readonly asientosService: AsientosContablesService,
    private readonly parametrizacionService: ParametrizacionContableService,
  ) { }

  async generarDefinicion(
    documentoId: string,
    queryRunner?: QueryRunner
  ): Promise<DefinicionAsientoDto> {
    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;

    // 1. Obtener la factura de compra con sus relaciones
    const gasto = await manager.findOne(FacturaCompra, {
      where: { id: documentoId },
      relations: [
        'proveedor',
        'items',
        'cuentaBancaria',
      ],
    });

    if (!gasto) {
      throw new NotFoundException(`Factura de compra con ID ${documentoId} no encontrada`);
    }

    const detalles: DefinicionDetalleAsientoDto[] = [];
    const terceroNombre = gasto.proveedor
      ? (gasto.proveedor.razonSocial || `${gasto.proveedor.nombre || ''} ${gasto.proveedor.apellido || ''}`.trim())
      : '';

    // 2. Débito: Cuentas de gasto agrupadas por artículo e IVA descontable
    const gastosAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();
    const ivaAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();

    for (const item of gasto.items) {
      const articulo = await manager.findOne(Articulo, {
        where: { id: item.articuloId },
        relations: [
          'categoriaArticulo',
          'categoriaArticulo.cuentaPrincipal',
          'impuestoRel',
          'impuestoRel.cuentaCompras',
        ],
      });

      if (!articulo?.categoriaArticulo?.cuentaPrincipal) {
        throw new Error(
          `Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`
        );
      }

      // Gastos
      const cuentaGasto = articulo.categoriaArticulo.cuentaPrincipal;
      const acumGasto = gastosAgrupados.get(cuentaGasto.id)?.valor ?? 0;
      gastosAgrupados.set(cuentaGasto.id, {
        valor: acumGasto + Number(item.valorSubtotal),
        cuenta: cuentaGasto,
      });

      // IVA descontable
      const valorIva = Number(item.valorIva) || 0;
      if (valorIva > 0) {
        let cuentaIva: CuentaContable;
        const cuentaIvaPorcentaje = await this.asientosService.obtenerCuentaImpuesto({
          impuestoId: item.impuestoId,
          tarifa: item.porcentajeIva || 0,
          tipo: 'IVA',
          operacion: 'compras',
        });

        if (cuentaIvaPorcentaje) {
          cuentaIva = cuentaIvaPorcentaje;
        } else if (articulo.impuestoRel?.cuentaCompras) {
          cuentaIva = articulo.impuestoRel.cuentaCompras;
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

    // Registrar gastos agrupados en el DTO
    for (const [_, item] of gastosAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: item.valor,
        credito: 0,
        concepto: `Gasto - ${item.cuenta.nombre}`,
        terceroId: gasto.proveedorId,
        terceroNombre,
      });
    }

    // Registrar IVA descontable en el DTO
    for (const [_, item] of ivaAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: item.valor,
        credito: 0,
        concepto: 'IVA descontable en compra',
        terceroId: gasto.proveedorId,
        terceroNombre,
      });
    }

    // 3. Crédito: Proveedores/Gastos por pagar (tanto para contado como crédito, el egreso posterior liquidará el saldo)
    // Lógica de Diferenciación CxP:
    let codigoCxP = '2205'; // Default proveedores
    if (gastosAgrupados.size > 0) {
      const cuentasInvolucradas = await manager.find(CuentaContable, {
        where: { id: In(Array.from(gastosAgrupados.keys())) },
      });
      if (cuentasInvolucradas.some((c) => c.codigo.startsWith('5'))) {
        codigoCxP = '2335'; // Gastos por pagar
      }
    }

    const descCredito = `${codigoCxP === '2335' ? 'Gasto por pagar' : 'Deuda con proveedor'} - Compra: ${gasto.numero || 'Borrador'}`;

    let cuentaCredito: CuentaContable;
    let proveedor: Proveedor | null = gasto.proveedor;
    if (!proveedor || !proveedor.cuentaContableId) {
      proveedor = await manager.findOne(Proveedor, {
        where: { id: gasto.proveedorId },
        relations: ['cuentaContable'],
      });
    }
    if (proveedor?.cuentaContable) {
      cuentaCredito = proveedor.cuentaContable;
    } else {
      const config = await this.parametrizacionService.getConfiguracion();
      if (config?.cuentaPagarProveedoresId) {
        const temp = await manager.findOne(CuentaContable, {
          where: { id: config.cuentaPagarProveedoresId },
        });
        cuentaCredito = temp || (await this.asientosService.obtenerCuentaPorCodigo(codigoCxP));
      } else {
        cuentaCredito = await this.asientosService.obtenerCuentaPorCodigo(codigoCxP);
      }
    }

    // Cruce de anticipos para compras
    const aplicaciones = await manager.find(AnticipoAplicacion, {
      where: {
        facturaCompraId: documentoId,
        estado: In([AplicacionEstado.ACTIVO, AplicacionEstado.BORRADOR]),
      },
      relations: ['anticipo', 'anticipo.cuentaContable'],
    });

    const montoAnticipoTotal = aplicaciones.reduce((sum, app) => sum + Number(app.montoAplicado), 0);
    const totalGastoNeto = MathUtil.sub(Number(gasto.total), montoAnticipoTotal);

    if (totalGastoNeto > 0) {
      detalles.push({
        cuentaId: cuentaCredito.id,
        cuentaCodigo: cuentaCredito.codigo,
        cuentaNombre: cuentaCredito.nombre,
        debito: 0,
        credito: totalGastoNeto,
        concepto: descCredito,
        terceroId: gasto.proveedorId,
        terceroNombre,
      });
    }

    for (const app of aplicaciones) {
      let cuentaAnticipo = app.anticipo?.cuentaContable;
      if (!cuentaAnticipo) {
        cuentaAnticipo = await this.asientosService.obtenerCuentaPorCodigo('133005');
      }
      detalles.push({
        cuentaId: cuentaAnticipo.id,
        cuentaCodigo: cuentaAnticipo.codigo,
        cuentaNombre: cuentaAnticipo.nombre,
        debito: 0,
        credito: Number(app.montoAplicado),
        concepto: `Cruce de anticipo ${app.anticipo?.numero || ''} en compra ${gasto.numero || 'Borrador'}`,
        terceroId: gasto.proveedorId,
        terceroNombre,
      });
    }

    // 3.5. Crédito: Descuentos en compras (si aplica)
    const descuento = Number(gasto.descuento) || 0;
    if (descuento > 0) {
      const cuentaDescuento = await this.asientosService.obtenerCuentaPorCodigo('421015');
      detalles.push({
        cuentaId: cuentaDescuento.id,
        cuentaCodigo: cuentaDescuento.codigo,
        cuentaNombre: cuentaDescuento.nombre,
        debito: 0,
        credito: descuento,
        concepto: 'Descuento obtenido en compra',
        terceroId: gasto.proveedorId,
        terceroNombre,
      });
    }

    // 4. Totales y balanceo
    const totalDebito = detalles.reduce((sum, d) => sum + d.debito, 0);
    const totalCredito = detalles.reduce((sum, d) => sum + d.credito, 0);
    const diferencia = Math.abs(totalDebito - totalCredito);
    const estaBalanceado = diferencia <= 0.01;

    return {
      tipo: 'GASTO',
      fecha: gasto.fecha || new Date(),
      referencia: gasto.numero || 'Borrador',
      descripcion: `Asiento automático - Gasto ${gasto.numero || '(Borrador)'}`,
      detalles,
      totalDebito,
      totalCredito,
      estaBalanceado,
      diferencia,
    };
  }
}
