import { Injectable, OnModuleInit, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, QueryRunner, In } from 'typeorm';
import { AsientosContablesService } from '../asientos-contables.service';
import { IContabilizacionStrategy } from './contabilizacion-strategy.interface';
import { DefinicionAsientoDto } from '../dto/definicion-asiento.dto';
import { AsientoContable } from '../entities/asientos-contable.entity';
import { NotaAjusteStrategy } from './strategies/nota-ajuste.strategy';
import { FacturaVentaStrategy } from './strategies/factura-venta.strategy';
import { FacturaCompraStrategy } from './strategies/factura-compra.strategy';
import { ComprobanteContableStrategy } from './strategies/comprobante-contable.strategy';
import { AnticipoAplicacion, AplicacionEstado } from 'src/pagos/entities/anticipo-aplicacion.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { ComprobanteContable, EstadoComprobante } from 'src/comprobantes/entities/comprobante-contable.entity';


@Injectable()
export class ContabilizacionEngine implements OnModuleInit {
  private readonly logger = new Logger(ContabilizacionEngine.name);
  private readonly strategiesMap = new Map<string, IContabilizacionStrategy>();

  constructor(
    private readonly asientosService: AsientosContablesService,
    private readonly dataSource: DataSource,
    private readonly notaAjusteStrategy: NotaAjusteStrategy,
    private readonly facturaVentaStrategy: FacturaVentaStrategy,
    private readonly facturaCompraStrategy: FacturaCompraStrategy,
    private readonly comprobanteContableStrategy: ComprobanteContableStrategy,
  ) { }

  onModuleInit() {
    this.strategiesMap.set(this.notaAjusteStrategy.tipoDocumento, this.notaAjusteStrategy);
    this.strategiesMap.set(this.facturaVentaStrategy.tipoDocumento, this.facturaVentaStrategy);
    this.strategiesMap.set(this.facturaCompraStrategy.tipoDocumento, this.facturaCompraStrategy);
    this.strategiesMap.set(this.comprobanteContableStrategy.tipoDocumento, this.comprobanteContableStrategy);
    this.logger.log('Motor de Contabilización inicializado con estrategias registradas.');
  }

  /**
   * Resuelve la estrategia para un tipo de documento.
   */
  private getStrategy(tipoDocumento: string): IContabilizacionStrategy {
    const strategy = this.strategiesMap.get(tipoDocumento);
    if (!strategy) {
      throw new NotFoundException(`No existe una estrategia de contabilización para el tipo: ${tipoDocumento}`);
    }
    return strategy;
  }

  /**
   * MODO SIMULACIÓN: Genera la vista previa en memoria del asiento contable.
   */
  async previsualizarAsiento(
    tipoDocumento: string,
    documentoId: string
  ): Promise<DefinicionAsientoDto> {
    if (tipoDocumento === 'COMPROBANTE_CONTABLE') {
      const comprobante = await this.dataSource.manager.findOne(ComprobanteContable, {
        where: { id: documentoId }
      });
      if (comprobante && (comprobante.estado === EstadoComprobante.CONTABILIZADO || comprobante.estado === EstadoComprobante.ANULADO)) {
        const queryBuilder = this.dataSource.manager.createQueryBuilder(AsientoContable, 'asiento')
          .leftJoinAndSelect('asiento.detalles', 'detalle')
          .leftJoinAndSelect('detalle.cuenta', 'cuenta')
          .leftJoinAndSelect('detalle.cliente', 'cliente')
          .leftJoinAndSelect('detalle.proveedor', 'proveedor')
          .leftJoinAndSelect('detalle.centroCosto', 'centroCosto');

        const originalAsiento = await this.dataSource.manager.findOne(AsientoContable, {
          where: { id: comprobante.asientoId }
        });

        const ids = [comprobante.asientoId];
        if (originalAsiento) {
          const reverso = await this.dataSource.manager.findOne(AsientoContable, {
            where: { referencia: `REV-${originalAsiento.numero}` }
          });
          if (reverso) {
            ids.push(reverso.id);
          }
        }

        const asientosFisicos = await queryBuilder
          .where('asiento.id IN (:...ids)', { ids })
          .orderBy('asiento.createdAt', 'ASC')
          .getMany();

        const mapped = asientosFisicos.map(a => {
          const detallesMapped = a.detalles.map(d => {
            let terceroNombre = '';
            if (d.cliente) {
              terceroNombre = d.cliente.razonSocial || `${d.cliente.nombre || ''} ${d.cliente.apellido || ''}`.trim();
            } else if (d.proveedor) {
              terceroNombre = d.proveedor.razonSocial || `${d.proveedor.nombre || ''} ${d.proveedor.apellido || ''}`.trim();
            }
            return {
              cuentaId: d.cuentaId,
              cuentaCodigo: d.cuenta?.codigo,
              cuentaNombre: d.cuenta?.nombre,
              debito: Number(d.debito),
              credito: Number(d.credito),
              concepto: d.descripcion,
              clienteId: d.clienteId || undefined,
              proveedorId: d.proveedorId || undefined,
              terceroId: d.clienteId || d.proveedorId || undefined,
              terceroNombre: terceroNombre || undefined,
              centroCostoId: d.centroCostoId || undefined,
              centroCostoNombre: d.centroCosto?.nombre || undefined,
              documentoReferencia: d.documentoReferencia || undefined,
            };
          });

          return {
            tipo: a.tipo,
            fecha: a.fecha,
            referencia: a.referencia,
            descripcion: a.descripcion,
            detalles: detallesMapped,
            totalDebito: Number(a.totalDebito),
            totalCredito: Number(a.totalCredito),
            estaBalanceado: true,
            diferencia: 0,
          };
        });

        if (comprobante.estado === EstadoComprobante.ANULADO && mapped.length > 0) {
          return mapped as any;
        }
        if (mapped.length > 0) {
          return mapped[0];
        }
      }
    }

    const strategy = this.getStrategy(tipoDocumento);
    const definicion = await strategy.generarDefinicion(documentoId);

    // Si es FACTURA_VENTA o GASTO (Factura de Compra), simular las líneas del cruce de anticipos
    if (tipoDocumento === 'FACTURA_VENTA') {
      const aplicaciones = await this.dataSource.manager.find(AnticipoAplicacion, {
        where: { facturaVentaId: documentoId, estado: AplicacionEstado.BORRADOR },
        relations: ['anticipo', 'anticipo.cuentaContable'],
      });

      if (aplicaciones.length > 0) {
        const factura = await this.dataSource.manager.findOne(FacturasVenta, {
          where: { id: documentoId },
          relations: ['client', 'client.cuentaContable'],
        });

        const clientConCuenta = factura?.client;
        const cuentaTerceroId = clientConCuenta?.cuentaContableId || 
          (await this.asientosService.obtenerCuentaPorCodigo('1305')).id;
        const cuentaTerceroCodigo = clientConCuenta?.cuentaContable?.codigo || '130505';
        const cuentaTerceroNombre = clientConCuenta?.cuentaContable?.nombre || 'Clientes';

        for (const app of aplicaciones) {
          const anticipo = app.anticipo;
          const cuentaAnticipo = anticipo?.cuentaContable || 
            await this.asientosService.obtenerCuentaPorCodigo('280505');

          // Inyectar línea de débito al anticipo
          definicion.detalles.push({
            cuentaId: cuentaAnticipo.id,
            cuentaCodigo: cuentaAnticipo.codigo,
            cuentaNombre: cuentaAnticipo.nombre,
            debito: Number(app.montoAplicado),
            credito: 0,
            concepto: `[Simulación Cruce] Anticipo ${anticipo?.numero || ''}`,
            terceroId: factura?.clientId,
            terceroNombre: clientConCuenta ? (clientConCuenta.razonSocial || `${clientConCuenta.nombre} ${clientConCuenta.apellido}`) : '',
          });

          // Inyectar línea de crédito a la cartera de clientes
          definicion.detalles.push({
            cuentaId: cuentaTerceroId,
            cuentaCodigo: cuentaTerceroCodigo,
            cuentaNombre: cuentaTerceroNombre,
            debito: 0,
            credito: Number(app.montoAplicado),
            concepto: `[Simulación Cruce] Anticipo ${anticipo?.numero || ''}`,
            terceroId: factura?.clientId,
            terceroNombre: clientConCuenta ? (clientConCuenta.razonSocial || `${clientConCuenta.nombre} ${clientConCuenta.apellido}`) : '',
          });
        }
      }
    } else if (tipoDocumento === 'GASTO') {
      const aplicaciones = await this.dataSource.manager.find(AnticipoAplicacion, {
        where: { facturaCompraId: documentoId, estado: AplicacionEstado.BORRADOR },
        relations: ['anticipo', 'anticipo.cuentaContable'],
      });

      if (aplicaciones.length > 0) {
        const gasto = await this.dataSource.manager.findOne(FacturaCompra, {
          where: { id: documentoId },
          relations: ['proveedor', 'proveedor.cuentaContable', 'items'],
        });

        const proveedorConCuenta = gasto?.proveedor;
        let codigoCxP = '2205';

        if (gasto?.items && gasto.items.length > 0) {
          const articulos = await this.dataSource.manager.find(Articulo, {
            where: { id: In(gasto.items.map(i => i.articuloId)) },
            relations: ['categoriaArticulo', 'categoriaArticulo.cuentaPrincipal'],
          });
          if (articulos.some(a => a.categoriaArticulo?.cuentaPrincipal?.codigo?.startsWith('5'))) {
            codigoCxP = '2335';
          }
        }

        const cuentaTerceroDefault = await this.asientosService.obtenerCuentaPorCodigo(codigoCxP);
        const cuentaTerceroId = proveedorConCuenta?.cuentaContableId || cuentaTerceroDefault.id;
        const cuentaTerceroCodigo = proveedorConCuenta?.cuentaContable?.codigo || cuentaTerceroDefault.codigo;
        const cuentaTerceroNombre = proveedorConCuenta?.cuentaContable?.nombre || cuentaTerceroDefault.nombre;

        for (const app of aplicaciones) {
          const anticipo = app.anticipo;
          const cuentaAnticipo = anticipo?.cuentaContable || 
            await this.asientosService.obtenerCuentaPorCodigo('133005');

          // Inyectar línea de débito a proveedores (CxP)
          definicion.detalles.push({
            cuentaId: cuentaTerceroId,
            cuentaCodigo: cuentaTerceroCodigo,
            cuentaNombre: cuentaTerceroNombre,
            debito: Number(app.montoAplicado),
            credito: 0,
            concepto: `[Simulación Cruce] Anticipo ${anticipo?.numero || ''}`,
            terceroId: gasto?.proveedorId,
            terceroNombre: proveedorConCuenta ? (proveedorConCuenta.razonSocial || `${proveedorConCuenta.nombre} ${proveedorConCuenta.apellido}`) : '',
          });

          // Inyectar línea de crédito al anticipo entregado
          definicion.detalles.push({
            cuentaId: cuentaAnticipo.id,
            cuentaCodigo: cuentaAnticipo.codigo,
            cuentaNombre: cuentaAnticipo.nombre,
            debito: 0,
            credito: Number(app.montoAplicado),
            concepto: `[Simulación Cruce] Anticipo ${anticipo?.numero || ''}`,
            terceroId: gasto?.proveedorId,
            terceroNombre: proveedorConCuenta ? (proveedorConCuenta.razonSocial || `${proveedorConCuenta.nombre} ${proveedorConCuenta.apellido}`) : '',
          });
        }
      }
    }

    // Recalcular totales de la previsualización combinada
    definicion.totalDebito = definicion.detalles.reduce((s, d) => s + d.debito, 0);
    definicion.totalCredito = definicion.detalles.reduce((s, d) => s + d.credito, 0);
    definicion.diferencia = Math.abs(definicion.totalDebito - definicion.totalCredito);
    definicion.estaBalanceado = definicion.diferencia <= 0.01;

    return definicion;
  }

  /**
   * MODO CONTABILIZACIÓN: Genera y persiste transaccionalmente el asiento contable definitivo.
   * Si se proporciona un queryRunner, se asume que la transacción se maneja externamente.
   */
  async contabilizarDocumento(tipoDocumento: string, documentoId: string, userId: string, queryRunner?: QueryRunner,): Promise<AsientoContable> {
    const strategy = this.getStrategy(tipoDocumento);
    const mustManageTransaction = !queryRunner;
    const qr = queryRunner || this.dataSource.createQueryRunner();

    if (mustManageTransaction) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      // Calcular la definición usando la transacción activa
      const definicion = await strategy.generarDefinicion(documentoId, qr);

      if (!definicion.estaBalanceado) {
        throw new BadRequestException(`No se puede contabilizar el documento. El asiento no está balanceado. Diferencia: ${definicion.diferencia}`);
      }

      // Persistir el asiento contable definitivo
      const asiento = await this.asientosService.crearAsientoDesdeDefinicion(definicion, userId, qr);

      if (mustManageTransaction) {
        await qr.commitTransaction();
      }
      return asiento;

    } catch (error: any) {
      if (mustManageTransaction) {
        await qr.rollbackTransaction();
      }
      this.logger.error(`Error al contabilizar documento [${tipoDocumento} - ${documentoId}]: ${error.message}`);
      throw error;

    } finally {
      if (mustManageTransaction) {
        await qr.release();
      }
    }
  }
}
