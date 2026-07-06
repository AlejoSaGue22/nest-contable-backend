import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryRunner, DataSource } from 'typeorm';
import { IContabilizacionStrategy } from '../contabilizacion-strategy.interface';
import { DefinicionAsientoDto, DefinicionDetalleAsientoDto } from '../../dto/definicion-asiento.dto';
import { AsientosContablesService } from '../../asientos-contables.service';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { FormaPago } from 'src/facturas-ventas/enums/factura-venta.enum';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';

@Injectable()
export class FacturaVentaStrategy implements IContabilizacionStrategy {
  readonly tipoDocumento = 'FACTURA_VENTA';

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

    // 1. Obtener la factura con sus relaciones
    const factura = await manager.findOne(FacturasVenta, {
      where: { id: documentoId },
      relations: [
        'client',
        'items',
        'cuentaBancaria',
        'metodoPagoRel',
      ],
    });

    if (!factura) {
      throw new NotFoundException(`Factura de venta con ID ${documentoId} no encontrada`);
    }

    const detalles: DefinicionDetalleAsientoDto[] = [];
    const terceroNombre = factura.client
      ? (factura.client.razonSocial || `${factura.client.nombre || ''} ${factura.client.apellido || ''}`.trim())
      : '';

    // 2. Débito: Clientes (tanto para contado como crédito, el cobro posterior liquidará el saldo)
    let cuentaDebito: CuentaContable;
    let client: Cliente | null = factura.client;
    if (!client || !client.cuentaContableId) {
      client = await manager.findOne(Cliente, {
        where: { id: factura.clientId },
        relations: ['cuentaContable'],
      });
    }
    if (client?.cuentaContable) {
      cuentaDebito = client.cuentaContable;
    } else {
      const config = await this.parametrizacionService.getConfiguracion();
      if (config?.cuentaCobrarClientesId) {
        const temp = await manager.findOne(CuentaContable, {
          where: { id: config.cuentaCobrarClientesId },
        });
        cuentaDebito = temp || (await this.asientosService.obtenerCuentaPorCodigo('1305'));
      } else {
        cuentaDebito = await this.asientosService.obtenerCuentaPorCodigo('1305');
      }
    }

    detalles.push({
      cuentaId: cuentaDebito.id,
      cuentaCodigo: cuentaDebito.codigo,
      cuentaNombre: cuentaDebito.nombre,
      debito: Number(factura.total),
      credito: 0,
      concepto: `Factura venta ${factura.comprobante_completo || 'Borrador'} - ${factura.metodoPagoRel?.nombre ?? factura.formaPago}`,
      terceroId: factura.clientId,
      terceroNombre,
    });

    // 3. Crédito: Ingresos agrupados por cuenta del artículo e IVA
    const ingresosAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();
    const ivaAgrupados = new Map<string, { valor: number; cuenta: CuentaContable }>();

    for (const item of factura.items) {
      const producto = await manager.findOne(Articulo, {
        where: { id: item.articuloId },
        relations: [
          'categoriaArticulo',
          'categoriaArticulo.cuentaPrincipal',
          'impuestoRel',
          'impuestoRel.cuentaVentas',
        ],
      });

      if (!producto?.categoriaArticulo?.cuentaPrincipal) {
        throw new Error(
          `Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`
        );
      }

      // Ingresos
      const cuentaIngreso = producto.categoriaArticulo.cuentaPrincipal;
      const acumIngreso = ingresosAgrupados.get(cuentaIngreso.id)?.valor ?? 0;
      ingresosAgrupados.set(cuentaIngreso.id, {
        valor: acumIngreso + Number(item.subtotal),
        cuenta: cuentaIngreso,
      });

      // IVA
      const valorIva = Number(item.valor_iva) || 0;
      if (valorIva > 0) {
        let cuentaIva: CuentaContable;
        const cuentaIvaPorcentaje = await this.asientosService.obtenerCuentaImpuesto({
          impuestoId: item.impuestoId,
          tarifa: item.iva || 0,
          tipo: 'IVA',
          operacion: 'ventas',
        });

        if (cuentaIvaPorcentaje) {
          cuentaIva = cuentaIvaPorcentaje;
        } else if (producto.impuestoRel?.cuentaVentas) {
          cuentaIva = producto.impuestoRel.cuentaVentas;
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

    // Registrar ingresos en el DTO
    for (const [_, item] of ingresosAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: 0,
        credito: item.valor,
        concepto: `Ingreso por ${item.cuenta.nombre}`,
        terceroId: factura.clientId,
        terceroNombre,
      });
    }

    // Registrar IVA en el DTO
    for (const [_, item] of ivaAgrupados) {
      detalles.push({
        cuentaId: item.cuenta.id,
        cuentaCodigo: item.cuenta.codigo,
        cuentaNombre: item.cuenta.nombre,
        debito: 0,
        credito: item.valor,
        concepto: 'IVA generado en venta',
        terceroId: factura.clientId,
        terceroNombre,
      });
    }

    // 4. Débito: Descuentos (si aplica)
    const descuento = Number(factura.descuento) || 0;
    if (descuento > 0) {
      const cuentaDescuento = await this.asientosService.obtenerCuentaPorCodigo('425030');
      detalles.push({
        cuentaId: cuentaDescuento.id,
        cuentaCodigo: cuentaDescuento.codigo,
        cuentaNombre: cuentaDescuento.nombre,
        debito: descuento,
        credito: 0,
        concepto: 'Descuento otorgado en venta',
        terceroId: factura.clientId,
        terceroNombre,
      });
    }

    // 5. Totales y balanceo
    const totalDebito = detalles.reduce((sum, d) => sum + d.debito, 0);
    const totalCredito = detalles.reduce((sum, d) => sum + d.credito, 0);
    const diferencia = Math.abs(totalDebito - totalCredito);
    const estaBalanceado = diferencia <= 0.01;

    return {
      tipo: 'FACTURA_VENTA',
      fecha: factura.fecha || new Date(),
      referencia: factura.comprobante_completo || 'Borrador',
      descripcion: `Asiento automático - Factura ${factura.comprobante_completo || '(Borrador)'}`,
      detalles,
      totalDebito,
      totalCredito,
      estaBalanceado,
      diferencia,
    };
  }
}
