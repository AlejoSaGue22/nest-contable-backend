import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner, DataSource } from 'typeorm';
import { IContabilizacionStrategy } from '../contabilizacion-strategy.interface';
import { DefinicionAsientoDto, DefinicionDetalleAsientoDto } from '../../dto/definicion-asiento.dto';
import { AsientosContablesService } from '../../asientos-contables.service';
import { NotaAjuste } from 'src/notas-ajuste/entities/notas-ajuste.entity';
import { TipoNota } from 'src/notas-ajuste/enums/notas-ajuste.enum';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { FormaPago } from 'src/facturas-ventas/enums/factura-venta.enum';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';

@Injectable()
export class NotaAjusteStrategy implements IContabilizacionStrategy {
  readonly tipoDocumento = 'NOTA_AJUSTE';

  constructor(
    private readonly dataSource: DataSource,
    private readonly asientosService: AsientosContablesService,
    private readonly parametrizacionService: ParametrizacionContableService,
  ) {}

  async generarDefinicion(
    documentoId: string,
    queryRunner?: QueryRunner
  ): Promise<DefinicionAsientoDto> {
    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;

    // 1. Obtener la nota de ajuste con relaciones
    const nota = await manager.findOne(NotaAjuste, {
      where: { id: documentoId },
      relations: [
        'facturaOriginal',
        'facturaOriginal.cuentaBancaria',
        'facturaOriginal.client',
        'items',
        'cliente',
      ],
    });

    if (!nota) {
      throw new NotFoundException(`Nota de ajuste con ID ${documentoId} no encontrada`);
    }

    const factura = nota.facturaOriginal;
    if (!factura) {
      throw new Error(`La nota de ajuste ${documentoId} no tiene una factura original asociada`);
    }

    const isNotaCredito = nota.tipo === TipoNota.CREDITO;
    const detalles: DefinicionDetalleAsientoDto[] = [];

    // Nombre legible del tercero
    const terceroNombre = nota.cliente
      ? (nota.cliente.razonSocial || `${nota.cliente.nombre || ''} ${nota.cliente.apellido || ''}`.trim())
      : '';

    // 2. Agrupar ingresos por cuenta contable (subtotal menos descuento) e IVA
    const ingresosAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();
    const ivaAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();

    for (const item of nota.items) {
      if (!item.articuloId) {
        throw new Error('El item de la nota no tiene un artículo vinculado (articuloId)');
      }

      const articulo = await manager.findOne(Articulo, {
        where: { id: item.articuloId },
        relations: [
          'categoriaArticulo',
          'categoriaArticulo.cuentaPrincipal',
          'impuestoRel',
          'impuestoRel.cuentaVentas',
        ],
      });

      if (!articulo?.categoriaArticulo?.cuentaPrincipal) {
        throw new Error(
          `Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`
        );
      }

      // Ingresos
      const cuentaIngreso = articulo.categoriaArticulo.cuentaPrincipal;
      const valorIngreso = Number(item.subtotal) - Number(item.valorDescuento);
      const acumIngreso = ingresosAgrupados.get(cuentaIngreso.id)?.valor ?? 0;
      ingresosAgrupados.set(cuentaIngreso.id, {
        valor: acumIngreso + valorIngreso,
        cuenta: cuentaIngreso,
      });

      // IVA
      const valorIva = Number(item.valorIVA) || 0;
      if (valorIva > 0) {
        let cuentaIva: CuentaContable;
        const cuentaIvaPorcentaje = await this.asientosService.obtenerCuentaImpuesto({
          impuestoId: (item as any).impuestoId,
          tarifa: item.porcentajeIVA || 0,
          tipo: 'IVA',
          operacion: 'ventas',
        });

        if (cuentaIvaPorcentaje) {
          cuentaIva = cuentaIvaPorcentaje;
        } else if (articulo.impuestoRel?.cuentaVentas) {
          cuentaIva = articulo.impuestoRel.cuentaVentas;
        } else {
          cuentaIva = await this.asientosService.obtenerCuentaPorCodigo('2408');
        }

        const acumIva = ivaAgrupados.get(cuentaIva.id)?.valor ?? 0;
        ivaAgrupados.set(cuentaIva.id, {
          valor: acumIva + valorIva,
          cuenta: cuentaIva,
        });
      }
    }

    // 3. Crear líneas de ingresos (Débito para NC, Crédito para ND)
    for (const [_, item] of ingresosAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: isNotaCredito ? item.valor : 0,
        credito: isNotaCredito ? 0 : item.valor,
        concepto: `${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} Ingreso - ${item.cuenta.nombre} | Nota: ${nota.numeroCompleto || 'Borrador'}`,
        terceroId: nota.clienteId,
        terceroNombre,
      });
    }

    // 4. Crear líneas de IVA (Débito para NC, Crédito para ND)
    for (const [_, item] of ivaAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: isNotaCredito ? item.valor : 0,
        credito: isNotaCredito ? 0 : item.valor,
        concepto: `${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} IVA | Nota: ${nota.numeroCompleto || 'Borrador'}`,
        terceroId: nota.clienteId,
        terceroNombre,
      });
    }

    // 5. Contrapartida (Crédito para NC, Débito para ND): Clientes o Caja/Bancos
    const isContado = factura.formaPago === FormaPago.CONTADO;
    let cuentaContra: CuentaContable;

    if (isContado) {
      const codigoCuentaContra = factura.cuentaBancaria?.codigoCuentaContable
        ? factura.cuentaBancaria.codigoCuentaContable
        : await this.asientosService.resolverCuentaContado(factura.metodoPago!);
      cuentaContra = await this.asientosService.obtenerCuentaPorCodigo(codigoCuentaContra);
    } else {
      let client: Cliente | null = factura.client;
      if (!client || !client.cuentaContableId) {
        client = await manager.findOne(Cliente, {
          where: { id: factura.clientId },
          relations: ['cuentaContable'],
        });
      }
      if (client?.cuentaContable) {
        cuentaContra = client.cuentaContable;
      } else {
        const config = await this.parametrizacionService.getConfiguracion();
        if (config?.cuentaCobrarClientesId) {
          const temp = await manager.findOne(CuentaContable, {
            where: { id: config.cuentaCobrarClientesId },
          });
          cuentaContra = temp || (await this.asientosService.obtenerCuentaPorCodigo('1305'));
        } else {
          cuentaContra = await this.asientosService.obtenerCuentaPorCodigo('1305');
        }
      }
    }

    detalles.push({
      cuentaId: cuentaContra.id,
      cuentaCodigo: cuentaContra.codigo,
      cuentaNombre: cuentaContra.nombre,
      debito: isNotaCredito ? 0 : Number(nota.total),
      credito: isNotaCredito ? Number(nota.total) : 0,
      concepto: `${isNotaCredito ? 'CRÉDITO' : 'DÉBITO'} Fact: ${factura.comprobante_completo} | Nota: ${nota.numeroCompleto || 'Borrador'}`,
      terceroId: nota.clienteId,
      terceroNombre,
    });

    // 6. Totales y balanceo
    const totalDebito = detalles.reduce((sum, d) => sum + d.debito, 0);
    const totalCredito = detalles.reduce((sum, d) => sum + d.credito, 0);
    const diferencia = Math.abs(totalDebito - totalCredito);
    const estaBalanceado = diferencia <= 0.01;

    return {
      tipo: isNotaCredito ? 'NOTA_CREDITO_VENTA' : 'NOTA_DEBITO_VENTA',
      fecha: nota.fecha || new Date(),
      referencia: nota.numeroCompleto || 'Borrador',
      descripcion: `Asiento automático - ${isNotaCredito ? 'Nota Crédito' : 'Nota Débito'} ${nota.numeroCompleto || '(Borrador)'}`,
      detalles,
      totalDebito,
      totalCredito,
      estaBalanceado,
      diferencia,
    };
  }
}
