import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AsientoContable, TipoAsiento } from './entities/asientos-contable.entity';
import { DataSource, In, Repository, QueryRunner } from 'typeorm';
import { AsientoDetalle } from './entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { DefinicionAsientoDto } from './dto/definicion-asiento.dto';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { FormaPago } from 'src/facturas-ventas/enums/factura-venta.enum';
import { NotaAjuste } from 'src/notas-ajuste/entities/notas-ajuste.entity';
import { TipoNota } from 'src/notas-ajuste/enums/notas-ajuste.enum';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { NotaAjusteCompra } from 'src/notas-ajuste-compras/entities/notas-ajuste-compra.entity';
import { TipoNotaCompra } from 'src/notas-ajuste-compras/enums/notas-ajuste-compra.enum';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { TipoPago } from 'src/pagos/enums/pago.enum';

import { ComprobanteContable, EstadoComprobante } from 'src/comprobantes/entities/comprobante-contable.entity';
import { TipoComprobante } from 'src/comprobantes/entities/tipo-comprobante.entity';
import { ComprobanteDetalle } from 'src/comprobantes/entities/comprobante-detalle.entity';

interface DetalleAsiento {
  cuentaId: string;
  debito: number;
  credito: number;
  descripcion: string;
  clienteId?: string;
  proveedorId?: string;
  centroCostoId?: string;
  baseGravable?: number;
  impuestoId?: string;
  porcentajeImpuesto?: number;
  tipoImpuesto?: string;
  documentoReferencia?: string;
}

@Injectable()
export class AsientosContablesService {
  private readonly logger = new Logger(AsientosContablesService.name);

  constructor(
    @InjectRepository(AsientoContable)
    private asientoRepository: Repository<AsientoContable>,

    @InjectRepository(AsientoDetalle)
    private detalleRepository: Repository<AsientoDetalle>,

    @InjectRepository(CuentaContable)
    private cuentaRepository: Repository<CuentaContable>,

    @InjectRepository(Impuesto)
    private impuestoRepository: Repository<Impuesto>,

    private dataSource: DataSource,
    private readonly parametrizacionService: ParametrizacionContableService,
  ) { }

  async findByReferencia(referencia: string) {
    const asientos = await this.asientoRepository.find({
      where: { referencia },
      relations: ['detalles', 'detalles.cuenta'],
      order: { createdAt: 'ASC' },
    });

    if (asientos.length > 0) {
      const ids = asientos.map((a) => a.id);
      const comprobantes = await this.dataSource.manager.find(ComprobanteContable, {
        where: { asientoId: In(ids) },
        select: ['id', 'asientoId'],
      });

      const compMap = new Map(comprobantes.map(c => [c.asientoId, c.id]));
      for (const a of asientos) {
        if (compMap.has(a.id)) {
          (a as any).comprobanteId = compMap.get(a.id);
        }
      }
    }

    return asientos;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. FACTURA DE VENTA -- DEPRECADA
  async generarAsientoFacturaVenta(factura: FacturasVenta, userId: string): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = [];

      // ── Débito: Caja / Bancos (contado) o Clientes (crédito) ─────────
      const isContado = factura.formaPago === FormaPago.CONTADO;
      let cuentaDebito: CuentaContable;
      if (isContado) {
        const codigoDebito = factura.cuentaBancaria.codigoCuentaContable
          ? factura.cuentaBancaria.codigoCuentaContable
          : await this.resolverCuentaContado(factura.metodoPago || undefined);
        cuentaDebito = await this.obtenerCuentaPorCodigo(codigoDebito);
      } else {
        let client: Cliente | null = factura.client;
        if (!client || !client.cuentaContableId) {
          client = await queryRunner.manager.findOne(Cliente, {
            where: { id: factura.clientId },
            relations: ['cuentaContable'],
          });
        }
        if (client?.cuentaContable) {
          cuentaDebito = client.cuentaContable;
        } else {
          const config = await this.parametrizacionService.getConfiguracion();
          if (config?.cuentaCobrarClientesId) {
            const temp = await queryRunner.manager.findOne(CuentaContable, {
              where: { id: config.cuentaCobrarClientesId },
            });
            cuentaDebito = temp || (await this.obtenerCuentaPorCodigo('1305'));
          } else {
            cuentaDebito = await this.obtenerCuentaPorCodigo('1305');
          }
        }
      }

      detalles.push({
        cuentaId: cuentaDebito.id,
        debito: factura.total,
        credito: 0,
        descripcion: `Factura venta ${factura.comprobante_completo} - ${factura.metodoPagoRel?.nombre ?? factura.formaPago}`,
      });

      // ── Crédito: Ingresos agrupados por cuenta del artículo ──────────
      const ingresosAgrupados = new Map<string, number>();
      const ivaAgrupados = new Map<string, number>();

      for (const item of factura.items) {
        const producto = await queryRunner.manager.findOne(Articulo, {
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
            `Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`,
          );
        }

        const cuentaId = producto.categoriaArticulo.cuentaPrincipalId;
        ingresosAgrupados.set(
          cuentaId,
          (ingresosAgrupados.get(cuentaId) ?? 0) + item.subtotal,
        );

        const valorIva = item.valor_iva || 0;
        if (valorIva > 0) {
          let cuentaIvaId: string;
          const cuentaIvaPorcentaje = await this.obtenerCuentaImpuesto({
            impuestoId: item.impuestoId,
            tarifa: item.iva || 0,
            tipo: 'IVA',
            operacion: 'ventas',
          });
          if (cuentaIvaPorcentaje) {
            cuentaIvaId = cuentaIvaPorcentaje.id;
          } else if (producto.impuestoRel?.cuentaVentasId) {
            cuentaIvaId = producto.impuestoRel.cuentaVentasId;
          } else {
            cuentaIvaId = '2408';
          }
          ivaAgrupados.set(
            cuentaIvaId,
            (ivaAgrupados.get(cuentaIvaId) ?? 0) + valorIva,
          );
        }
      }

      for (const [cuentaId, valor] of ingresosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        if (!cuenta)
          throw new Error(`Cuenta contable ${cuentaId} no encontrada`);

        detalles.push({
          cuentaId,
          debito: 0,
          credito: valor,
          descripcion: `Ingreso por ${cuenta.nombre}`,
        });
      }

      // ── Crédito: IVA por Pagar ────────────────────────────────────────
      for (const [cuentaId, valor] of ivaAgrupados) {
        detalles.push({
          cuentaId: cuentaId,
          debito: 0,
          credito: valor,
          descripcion: 'IVA generado en venta',
        });
      }

      // ── Débito: Descuentos (si aplica) ───────────────────────────────
      if (factura.descuento > 0) {
        const cuentaDescuento = await this.obtenerCuentaPorCodigo('4175');
        detalles.push({
          cuentaId: cuentaDescuento.id,
          debito: factura.descuento,
          credito: 0,
          descripcion: 'Descuento otorgado en venta',
        });
      }

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.FACTURA_VENTA,
          fecha: factura.fecha,
          referencia: factura.comprobante_completo,
          descripcion: `Asiento automático - Factura ${factura.comprobante_completo}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento FACTURA_VENTA generado: ${asiento.numero}`);
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asiento factura venta: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al generar asiento contable de factura de venta: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. GASTO / FACTURA DE COMPRA -- DEPRECADA
  async generarAsientoGasto(
    gasto: FacturaCompra,
    userId: string,
  ): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = [];

      // ── Débito: Cuentas de gasto agrupadas por artículo ──────────────
      const gastosAgrupados = new Map<string, number>();
      const ivaAgrupados = new Map<string, number>();

      for (const item of gasto.items) {
        let cuentaId = '';
        let articulo: Articulo | null = null;

        if (item.articuloId) {
          articulo = await queryRunner.manager.findOne(Articulo, {
            where: { id: item.articuloId },
            relations: [
              'categoriaArticulo',
              'categoriaArticulo.cuentaPrincipal',
              'impuestoRel',
              'impuestoRel.cuentaCompras',
            ],
          });

          if (!articulo?.categoriaArticulo?.cuentaPrincipal) {
            throw new Error(`Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`);
          }

          cuentaId = articulo.categoriaArticulo.cuentaPrincipalId;
        } else if (item.cuentaContableId) {
          cuentaId = item.cuentaContableId;
        }

        if (cuentaId) {
          gastosAgrupados.set(cuentaId, (gastosAgrupados.get(cuentaId) ?? 0) + item.valorSubtotal);
        }

        if (item.valorIva > 0) {
          let cuentaIvaId: string;
          const cuentaIvaPorcentaje = await this.obtenerCuentaImpuesto({
            impuestoId: item.impuestoId,
            tarifa: item.porcentajeIva || 0,
            tipo: 'IVA',
            operacion: 'compras',
          });
          if (cuentaIvaPorcentaje) {
            cuentaIvaId = cuentaIvaPorcentaje.id;
          } else if (articulo?.impuestoRel?.cuentaComprasId) {
            cuentaIvaId = articulo.impuestoRel.cuentaComprasId;
          } else {
            cuentaIvaId = '1355';
          }
          ivaAgrupados.set(
            cuentaIvaId,
            (ivaAgrupados.get(cuentaIvaId) ?? 0) + item.valorIva,
          );
        }
      }

      for (const [cuentaId, valor] of gastosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        detalles.push({
          cuentaId,
          debito: valor,
          credito: 0,
          descripcion: `Gasto - ${cuenta?.nombre}`,
        });
      }

      // ── Débito: IVA Descontable ───────────────────────────────────────
      for (const [cuentaId, valor] of ivaAgrupados) {
        detalles.push({
          cuentaId: cuentaId,
          debito: valor,
          credito: 0,
          descripcion: 'IVA descontable en compra',
        });
      }

      // ── Crédito: Caja/Bancos (contado) o Proveedores/Gastos (crédito) ──────
      const isContado = gasto.formaPago === FormaPago.CONTADO;

      // Lógica de Diferenciación CxP:
      // Si el gasto tiene cuentas que empiezan por '5' (Gastos), usamos '2335'
      // Si tiene cuentas que empiezan por '14' (Inventarios) o '6' (Costos), usamos '2205'
      let codigoCxP = '2205'; // Default

      if (gastosAgrupados.size > 0) {
        const cuentasInvolucradas = await queryRunner.manager.find(CuentaContable,
          { where: { id: In(Array.from(gastosAgrupados.keys())) } }
        );
        if (cuentasInvolucradas.some((c) => c.codigo.startsWith('5'))) {
          codigoCxP = '2335';
        }
      }

      const codigoCreditoPlaceholder = isContado
        ? gasto.cuentaBancaria.codigoCuentaContable
          ? gasto.cuentaBancaria.codigoCuentaContable
          : await this.resolverCuentaContado(gasto.metodoPago ?? undefined)
        : codigoCxP;

      const descCredito = isContado
        ? `Pago ${gasto.metodoPago ?? 'contado'} - Proveedor: ${gasto.proveedor.identificacion}`
        : `${codigoCxP === '2335' ? 'Gasto por pagar' : 'Deuda con proveedor'} - Compra: ${gasto.numero}`;

      let cuentaCredito: CuentaContable;
      if (isContado) {
        cuentaCredito = await this.obtenerCuentaPorCodigo(
          codigoCreditoPlaceholder,
        );
      } else {
        let proveedor: Proveedor | null = gasto.proveedor;
        if (!proveedor || !proveedor.cuentaContableId) {
          proveedor = await queryRunner.manager.findOne(Proveedor, {
            where: { id: gasto.proveedorId },
            relations: ['cuentaContable'],
          });
        }
        if (proveedor?.cuentaContable) {
          cuentaCredito = proveedor.cuentaContable;
        } else {
          const config = await this.parametrizacionService.getConfiguracion();
          if (config?.cuentaPagarProveedoresId) {
            const temp = await queryRunner.manager.findOne(CuentaContable, {
              where: { id: config.cuentaPagarProveedoresId },
            });
            cuentaCredito =
              temp || (await this.obtenerCuentaPorCodigo(codigoCxP));
          } else {
            cuentaCredito = await this.obtenerCuentaPorCodigo(codigoCxP);
          }
        }
      }

      detalles.push({
        cuentaId: cuentaCredito.id,
        debito: 0,
        credito: gasto.total,
        descripcion: descCredito,
      });

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.GASTO,
          fecha: gasto.fecha,
          referencia: gasto.numero!,
          descripcion: `Asiento automático - Gasto ${gasto.numero}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento GASTO generado: ${asiento.numero}`);
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error asiento gasto: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al generar asiento contable de gasto: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. ANULACIÓN FACTURA DE VENTA  (reversa exacta del asiento original)
  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoAnulacionFacturaVenta(
    factura: FacturasVenta,
    userId: string,
  ): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = [];

      // ── Crédito: reversa de Clientes ──────────────────
      let cuentaDebito: CuentaContable;
      let client: Cliente | null = factura.client;
      if (!client || !client.cuentaContableId) {
        client = await queryRunner.manager.findOne(Cliente, {
          where: { id: factura.clientId },
          relations: ['cuentaContable'],
        });
      }
      if (client?.cuentaContable) {
        cuentaDebito = client.cuentaContable;
      } else {
        const config = await this.parametrizacionService.getConfiguracion();
        if (config?.cuentaCobrarClientesId) {
          const temp = await queryRunner.manager.findOne(CuentaContable, {
            where: { id: config.cuentaCobrarClientesId },
          });
          cuentaDebito = temp || (await this.obtenerCuentaPorCodigo('1305'));
        } else {
          cuentaDebito = await this.obtenerCuentaPorCodigo('1305');
        }
      }

      detalles.push({
        cuentaId: cuentaDebito.id,
        debito: 0,
        credito: factura.total,
        descripcion: `ANULACIÓN - Factura ${factura.comprobante_completo}`,
      });

      // ── Débito: reversa de Ingresos ───────────────────────────────────
      const ingresosAgrupados = new Map<string, number>();
      const ivaAgrupados = new Map<string, number>();

      for (const item of factura.items) {
        const producto = await queryRunner.manager.findOne(Articulo, {
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
            `Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`,
          );
        }

        const cuentaId = producto.categoriaArticulo.cuentaPrincipalId;
        ingresosAgrupados.set(
          cuentaId,
          (ingresosAgrupados.get(cuentaId) ?? 0) + item.subtotal,
        );

        const valorIva = (item as any).valor_iva || 0;
        if (valorIva > 0) {
          let cuentaIvaId: string;
          const ivaPorcentaje = item.iva || 0;
          const cuentaIvaPorcentaje = await this.obtenerCuentaImpuesto({
            impuestoId: (item as any).impuestoId,
            tarifa: item.iva || 0,
            tipo: 'IVA',
            operacion: 'ventas',
          });
          if (cuentaIvaPorcentaje) {
            cuentaIvaId = cuentaIvaPorcentaje.id;
          } else if (producto.impuestoRel?.cuentaVentasId) {
            cuentaIvaId = producto.impuestoRel.cuentaVentasId;
          } else {
            cuentaIvaId = '2408';
          }
          ivaAgrupados.set(
            cuentaIvaId,
            (ivaAgrupados.get(cuentaIvaId) ?? 0) + valorIva,
          );
        }
      }

      for (const [cuentaId, valor] of ingresosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        if (!cuenta)
          throw new Error(`Cuenta contable ${cuentaId} no encontrada`);

        detalles.push({
          cuentaId,
          debito: valor,
          credito: 0,
          descripcion: `ANULACIÓN - Ingreso por ${cuenta.nombre}`,
        });
      }

      // ── Débito: reversa de IVA por Pagar ────────────────────────────
      for (const [cuentaId, valor] of ivaAgrupados) {
        detalles.push({
          cuentaId: cuentaId,
          debito: valor,
          credito: 0,
          descripcion: 'ANULACIÓN - IVA generado en venta',
        });
      }

      // ── Crédito: reversa de Descuentos ───────────────────────────────
      if (factura.descuento > 0) {
        const cuentaDescuento = await this.obtenerCuentaPorCodigo('4175');
        detalles.push({
          cuentaId: cuentaDescuento.id,
          debito: 0,
          credito: factura.descuento,
          descripcion: 'ANULACIÓN - Descuento otorgado en venta',
        });
      }

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.ANULACION_FACTURA_VENTA,
          fecha: new Date(),
          referencia: factura.comprobante_completo,
          descripcion: `Asiento ANULACIÓN - Factura ${factura.comprobante_completo}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento ANULACION generado: ${asiento.numero}`);
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asiento anulación: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al generar asiento de anulación: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //
  // 6. ANULACIÓN FACTURA DE COMPRA  (reversa exacta del asiento original)
  //

  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoAnulacionFacturaCompra(
    gasto: FacturaCompra,
    userId: string,
  ): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = [];

      // ── Agrupar Gastos por artículo (se necesita para determinar la cuenta de CxP y para las líneas de crédito) ──
      const gastosAgrupados = new Map<string, number>();
      const ivaAgrupados = new Map<string, number>();

      for (const item of gasto.items) {
        let cuentaId = '';
        let articulo: Articulo | null = null;

        if (item.articuloId) {
          articulo = await queryRunner.manager.findOne(Articulo, {
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
              `Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`,
            );
          }

          cuentaId = articulo.categoriaArticulo.cuentaPrincipalId;
        } else if (item.cuentaContableId) {
          cuentaId = item.cuentaContableId;
        }

        if (cuentaId) {
          gastosAgrupados.set(
            cuentaId,
            (gastosAgrupados.get(cuentaId) ?? 0) + item.valorSubtotal,
          );
        }

        if (item.valorIva > 0) {
          let cuentaIvaId: string;
          const cuentaIvaPorcentaje = await this.obtenerCuentaImpuesto({
            impuestoId: (item as any).impuestoId,
            tarifa: item.porcentajeIva || 0,
            tipo: 'IVA',
            operacion: 'compras',
          });
          if (cuentaIvaPorcentaje) {
            cuentaIvaId = cuentaIvaPorcentaje.id;
          } else if (articulo?.impuestoRel?.cuentaComprasId) {
            cuentaIvaId = articulo.impuestoRel.cuentaComprasId;
          } else {
            cuentaIvaId = '1355';
          }
          ivaAgrupados.set(
            cuentaIvaId,
            (ivaAgrupados.get(cuentaIvaId) ?? 0) + item.valorIva,
          );
        }
      }

      // ── Débito: reversa de Proveedores / Cuentas por Pagar ────────────────────────
      // Lógica de Diferenciación CxP:
      let codigoCxP = '2205';
      if (gastosAgrupados.size > 0) {
        const cuentasInvolucradas = await queryRunner.manager.find(
          CuentaContable,
          {
            where: { id: In(Array.from(gastosAgrupados.keys())) },
          },
        );
        if (cuentasInvolucradas.some((c) => c.codigo.startsWith('5'))) {
          codigoCxP = '2335';
        }
      }

      const descDebito = `ANULACIÓN ${codigoCxP === '2335' ? 'gasto por pagar' : 'deuda con proveedor'} - Compra: ${gasto.numero}`;

      let cuentaDebito: CuentaContable;
      let proveedor: Proveedor | null = gasto.proveedor;
      if (!proveedor || !proveedor.cuentaContableId) {
        proveedor = await queryRunner.manager.findOne(Proveedor, {
          where: { id: gasto.proveedorId },
          relations: ['cuentaContable'],
        });
      }
      if (proveedor?.cuentaContable) {
        cuentaDebito = proveedor.cuentaContable;
      } else {
        const config = await this.parametrizacionService.getConfiguracion();
        if (config?.cuentaPagarProveedoresId) {
          const temp = await queryRunner.manager.findOne(CuentaContable, {
            where: { id: config.cuentaPagarProveedoresId },
          });
          cuentaDebito = temp || (await this.obtenerCuentaPorCodigo(codigoCxP));
        } else {
          cuentaDebito = await this.obtenerCuentaPorCodigo(codigoCxP);
        }
      }

      detalles.push({
        cuentaId: cuentaDebito.id,
        debito: gasto.total,
        credito: 0,
        descripcion: descDebito,
      });

      // ── Crédito: reversa de Gastos agrupados por artículo ────────────
      // Lo que originalmente fue DÉBITO ahora es CRÉDITO
      for (const [cuentaId, valor] of gastosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        detalles.push({
          cuentaId,
          debito: 0,
          credito: valor,
          descripcion: `ANULACIÓN - Gasto ${cuenta?.nombre}`,
        });
      }

      // ── Crédito: reversa de IVA Descontable ──────────────────────────
      for (const [cuentaId, valor] of ivaAgrupados) {
        detalles.push({
          cuentaId: cuentaId,
          debito: 0,
          credito: valor,
          descripcion: 'ANULACIÓN - IVA descontable en compra',
        });
      }

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.ANULACION_FACTURA_COMPRA,
          fecha: new Date(),
          referencia: gasto.numero!,
          descripcion: `Asiento ANULACIÓN - Compra ${gasto.numero}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento ANULACION_COMPRA generado: ${asiento.numero}`);
      return asiento;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error asiento anulación compra: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al generar asiento de anulación de compra: ${error.message}`);

    } finally {
      await queryRunner.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. NOTA DE AJUSTE (CRÉDITO / DÉBITO)
  //
  // NC (CRÉDITO): DÉBITO Ingresos (xArt) + IVA 2408 | CRÉDITO Clientes 1305 / Caja-Bancos
  // ND (DÉBITO):  DÉBITO Clientes 1305 / Caja-Bancos | CRÉDITO Ingresos (xArt) + IVA 2408
  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoNotaAjuste(nota: NotaAjuste, userId: string): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = nota.facturaOriginal;
      const isNotaCredito = nota.tipo === TipoNota.CREDITO;
      const detalles: DetalleAsiento[] = [];

      // 1. Agrupar ingresos por cuenta contable de los artículos (subtotal menos descuento)
      const ingresosAgrupados = new Map<string, number>();
      const ivaAgrupados = new Map<string, number>();

      for (const item of nota.items) {
        if (!item.articuloId) {
          throw new Error(
            'El item de la nota no tiene un artículo vinculado (articuloId)',
          );
        }

        const articulo = await queryRunner.manager.findOne(Articulo, {
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
            `Artículo ${item.articuloId} no tiene cuenta contable principal configurada en su categoría`,
          );
        }

        const cuentaId = articulo.categoriaArticulo.cuentaPrincipalId;
        // Para NC: usar subtotal menos descuento aplicado
        const valorIngreso =
          Number(item.subtotal) - Number(item.valorDescuento);
        ingresosAgrupados.set(
          cuentaId,
          (ingresosAgrupados.get(cuentaId) ?? 0) + valorIngreso,
        );

        const valorIva = Number(item.valorIVA) || 0;
        if (valorIva > 0) {
          let cuentaIvaId: string;
          const ivaPorcentaje = item.porcentajeIVA || 0;
          const cuentaIvaPorcentaje = await this.obtenerCuentaImpuesto({
            impuestoId: (item as any).impuestoId,
            tarifa: item.porcentajeIVA || 0,
            tipo: 'IVA',
            operacion: 'ventas',
          });
          if (cuentaIvaPorcentaje) {
            cuentaIvaId = cuentaIvaPorcentaje.id;
          } else if (articulo.impuestoRel?.cuentaVentasId) {
            cuentaIvaId = articulo.impuestoRel.cuentaVentasId;
          } else {
            cuentaIvaId = '2408';
          }
          ivaAgrupados.set(
            cuentaIvaId,
            (ivaAgrupados.get(cuentaIvaId) ?? 0) + valorIva,
          );
        }
      }

      // 2. Procesar líneas de ingresos (Débito para NC, Crédito para ND)
      for (const [cuentaId, valor] of ingresosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });

        detalles.push({
          cuentaId,
          debito: isNotaCredito ? valor : 0,
          credito: isNotaCredito ? 0 : valor,
          descripcion: `${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} Ingreso - ${cuenta?.nombre} | Nota: ${nota.numeroCompleto}`,
        });
      }

      // 3. IVA (Débito para NC, Crédito para ND)
      for (const [cuentaId, valor] of ivaAgrupados) {
        detalles.push({
          cuentaId: cuentaId,
          debito: isNotaCredito ? valor : 0,
          credito: isNotaCredito ? 0 : valor,
          descripcion: `${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} IVA | Nota: ${nota.numeroCompleto}`,
        });
      }

      // 4. Contrapartida (Crédito para NC, Débito para ND): Clientes o Caja/Bancos
      const isContado = factura.formaPago === FormaPago.CONTADO;
      let cuentaContra: CuentaContable;
      if (isContado) {
        const codigoCuentaContra = factura.cuentaBancaria?.codigoCuentaContable
          ? factura.cuentaBancaria.codigoCuentaContable
          : await this.resolverCuentaContado(factura.metodoPago!);
        cuentaContra = await this.obtenerCuentaPorCodigo(codigoCuentaContra);
      } else {
        let client: Cliente | null = factura.client;
        if (!client || !client.cuentaContableId) {
          client = await queryRunner.manager.findOne(Cliente, {
            where: { id: factura.clientId },
            relations: ['cuentaContable'],
          });
        }
        if (client?.cuentaContable) {
          cuentaContra = client.cuentaContable;
        } else {
          const config = await this.parametrizacionService.getConfiguracion();
          if (config?.cuentaCobrarClientesId) {
            const temp = await queryRunner.manager.findOne(CuentaContable, {
              where: { id: config.cuentaCobrarClientesId },
            });
            cuentaContra = temp || (await this.obtenerCuentaPorCodigo('1305'));
          } else {
            cuentaContra = await this.obtenerCuentaPorCodigo('1305');
          }
        }
      }

      detalles.push({
        cuentaId: cuentaContra.id,
        debito: isNotaCredito ? 0 : Number(nota.total),
        credito: isNotaCredito ? Number(nota.total) : 0,
        descripcion: `${isNotaCredito ? 'CRÉDITO' : 'DÉBITO'} Fact: ${factura.comprobante_completo} | Nota: ${nota.numeroCompleto}`,
      });

      const asiento = await this.crearAsiento(
        {
          tipo: isNotaCredito
            ? TipoAsiento.NOTA_CREDITO_VENTA
            : TipoAsiento.NOTA_DEBITO_VENTA,
          fecha: nota.fecha,
          referencia: nota.numeroCompleto,
          descripcion: `Asiento automático - ${isNotaCredito ? 'Nota Crédito' : 'Nota Débito'} ${nota.numeroCompleto}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento ${asiento.tipo} generado: ${asiento.numero}`);
      return asiento;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error asiento nota ajuste: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al generar asiento contable de nota de ajuste: ${error.message}`);

    } finally {
      await queryRunner.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. COBRO  (abono sobre factura de venta a crédito)  ← NUEVO
  //
  // Recibe el monto exacto del abono, NO el total de la factura.
  // Soporta cobros parciales (múltiples abonos sobre la misma factura).
  //
  // DÉBITO:  Caja 1105  (medioPago = 'caja')
  //      o   Bancos 1110 (medioPago = 'banco' | 'transferencia' | 'cheque')
  // CRÉDITO: Clientes 1305
  //
  // Llamado desde: PagosService.registrarCobro()
  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoCobro(
    params: {
      facturaVenta: FacturasVenta;
      monto: number;
      fecha: Date;
      cuentaDebitoCodigo?: string; // '1105' | '1110' (legacy/default)
      cuentaBancariaId?: string;
      medioPago?: string;
      userId: string;
    },
    qr?: QueryRunner,
  ): Promise<AsientoContable> {
    const { facturaVenta, monto, fecha, cuentaDebitoCodigo, cuentaBancariaId, medioPago, userId } = params;

    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      const cuentaDebito = await this.resolverCuentaTesoreria(
        { cuentaBancariaId, medioPago, fallbackCodigo: cuentaDebitoCodigo || '1110' },
        queryRunner,
      );
      let cuentaCredito: CuentaContable;
      let client: Cliente | null = facturaVenta.client;
      if (!client || !client.cuentaContableId) {
        client = await queryRunner.manager.findOne(Cliente, {
          where: { id: facturaVenta.clientId },
          relations: ['cuentaContable'],
        });
      }
      if (client?.cuentaContable) {
        cuentaCredito = client.cuentaContable;
      } else {
        const config = await this.parametrizacionService.getConfiguracion();
        if (config?.cuentaCobrarClientesId) {
          const temp = await queryRunner.manager.findOne(CuentaContable, {
            where: { id: config.cuentaCobrarClientesId },
          });
          cuentaCredito = temp || (await this.obtenerCuentaPorCodigo('1305'));
        } else {
          cuentaCredito = await this.obtenerCuentaPorCodigo('1305');
        }
      }
      const medioPagoLabel = cuentaDebito.codigo === '1105' ? 'Caja' : 'Banco';

      const detalles: DetalleAsiento[] = [
        {
          cuentaId: cuentaDebito.id,
          debito: monto,
          credito: 0,
          descripcion: `Cobro en ${medioPagoLabel} - Fact: ${facturaVenta.comprobante_completo}`,
        },
        {
          cuentaId: cuentaCredito.id,
          debito: 0,
          credito: monto,
          descripcion: `Abono CxC - Fact: ${facturaVenta.comprobante_completo} | Cliente: ${facturaVenta.client?.numeroDocumento ?? ''}`,
        },
      ];

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.COBRO,
          fecha,
          referencia: facturaVenta.comprobante_completo,
          descripcion: `Cobro $${monto.toLocaleString('es-CO')} - Factura ${facturaVenta.comprobante_completo}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }
      this.logger.log(
        `Asiento COBRO generado: ${asiento.numero} | $${monto} | Fact: ${facturaVenta.comprobante_completo}`,
      );
      return asiento;
    } catch (error) {
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error asiento cobro: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al generar asiento de cobro: ${error.message}`,
      );
    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
    }
  }

  async generarAsientoReverso(
    asientoId: string,
    tipoReverso: TipoAsiento,
    userId: string,
    qr?: QueryRunner,
  ): Promise<AsientoContable> {
    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      const asientoOriginal = await queryRunner.manager.findOne(AsientoContable, {
        where: { id: asientoId },
        relations: ['detalles'],
      });

      if (!asientoOriginal) {
        throw new NotFoundException(`Asiento original con ID ${asientoId} no encontrado`);
      }

      // Intercambiar débitos y créditos
      const detallesReverso: DetalleAsiento[] = asientoOriginal.detalles.map(d => ({
        cuentaId: d.cuentaId,
        debito: Number(d.credito),
        credito: Number(d.debito),
        descripcion: `Reverso - ${d.descripcion || ''}`.substring(0, 255),
      }));

      const asientoReverso = await this.crearAsiento(
        {
          tipo: tipoReverso,
          fecha: new Date(),
          referencia: `REV-${asientoOriginal.numero}`,
          descripcion: `Reverso del asiento ${asientoOriginal.numero} - Motivo: Anulación de pago`,
          detalles: detallesReverso,
          userId,
        },
        queryRunner,
      );

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }

      return asientoReverso;
    } catch (error) {
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error generando asiento de reverso: ${error.message}`, error.stack);
      throw error;
    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. PAGO A PROVEEDOR  (abono sobre factura de compra a crédito)  ← NUEVO
  //
  // Recibe el monto exacto del pago, NO el total de la factura.
  // Soporta pagos parciales (múltiples pagos sobre la misma compra).
  //
  // DÉBITO:  Proveedores 2205
  // CRÉDITO: Caja 1105  (medioPago = 'caja')
  //      o   Bancos 1110 (medioPago = 'banco' | 'transferencia' | 'cheque')
  //
  // Llamado desde: PagosService.registrarPago()
  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoPagoCompra(
    params: {
      facturaCompra: FacturaCompra;
      monto: number;
      fecha: Date;
      cuentaCreditoCodigo?: string; // '1105' | '1110' (legacy/default)
      cuentaBancariaId?: string;
      medioPago?: string;
      userId: string;
    },
    qr?: QueryRunner,
  ): Promise<AsientoContable> {
    const { facturaCompra, monto, fecha, cuentaCreditoCodigo, cuentaBancariaId, medioPago, userId } = params;

    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      let cuentaDebito: CuentaContable;
      let proveedor: Proveedor | null = facturaCompra.proveedor;
      if (!proveedor || !proveedor.cuentaContableId) {
        proveedor = await queryRunner.manager.findOne(Proveedor, {
          where: { id: facturaCompra.proveedorId },
          relations: ['cuentaContable'],
        });
      }
      if (proveedor?.cuentaContable) {
        cuentaDebito = proveedor.cuentaContable;
      } else {
        const config = await this.parametrizacionService.getConfiguracion();
        if (config?.cuentaPagarProveedoresId) {
          const temp = await queryRunner.manager.findOne(CuentaContable, { where: { id: config.cuentaPagarProveedoresId } });
          cuentaDebito = temp || (await this.obtenerCuentaPorCodigo('2205'));
        } else {
          cuentaDebito = await this.obtenerCuentaPorCodigo('2205');
        }
      }
      const cuentaCredito = await this.resolverCuentaTesoreria(
        { cuentaBancariaId, medioPago, fallbackCodigo: cuentaCreditoCodigo || '1110' },
        queryRunner,
      );
      const medioPagoLabel = cuentaCredito.codigo === '1105' ? 'Caja' : 'Banco';

      const detalles: DetalleAsiento[] = [
        {
          cuentaId: cuentaDebito.id,
          debito: monto,
          credito: 0,
          descripcion: `Pago CxP - Compra: ${facturaCompra.numero} | Proveedor: ${facturaCompra.proveedor?.identificacion ?? ''}`,
        },
        {
          cuentaId: cuentaCredito.id,
          debito: 0,
          credito: monto,
          descripcion: `Pago desde ${medioPagoLabel} - Compra: ${facturaCompra.numero}`,
        },
      ];

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.PAGO_PROVEEDOR,
          fecha,
          referencia: facturaCompra.numero!,
          descripcion: `Pago $${monto.toLocaleString('es-CO')} a proveedor - Compra ${facturaCompra.numero}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }
      this.logger.log(`Asiento PAGO_PROVEEDOR generado: ${asiento.numero} | $${monto} | Compra: ${facturaCompra.numero}`);
      return asiento;

    } catch (error) {
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error asiento pago proveedor: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al generar asiento de pago a proveedor: ${error.message}`);

    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NUEVOS MÉTODOS DE CONTABILIZACIÓN FLEXIBLE
  // ══════════════════════════════════════════════════════════════════════════

  async generarAsientoCobroMultiple(
    params: {
      clienteId: string;
      facturasAbonos: Array<{ facturaVenta: FacturasVenta; monto: number }>;
      montoTotal: number;
      fecha: Date;
      cuentaDebitoCodigo?: string;
      cuentaBancariaId?: string;
      medioPago?: string;
      userId: string;
    },
    qr?: QueryRunner,
  ): Promise<AsientoContable> {
    const { clienteId, facturasAbonos, montoTotal, fecha, cuentaDebitoCodigo, cuentaBancariaId, medioPago, userId } = params;
    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      const cuentaDebito = await this.resolverCuentaTesoreria(
        { cuentaBancariaId, medioPago, fallbackCodigo: cuentaDebitoCodigo || '1110' },
        queryRunner,
      );

      const detalles: DetalleAsiento[] = [];
      const medioPagoLabel = cuentaDebito.codigo === '1105' ? 'Caja' : 'Banco';

      // 1. Débito a Caja/Banco por el total recibido
      detalles.push({
        cuentaId: cuentaDebito.id,
        debito: montoTotal,
        credito: 0,
        descripcion: `Cobro Múltiple en ${medioPagoLabel}`,
      });

      // 2. Crédito a la cuenta contable de cartera de cada factura de venta abonada
      for (const item of facturasAbonos) {
        let cuentaCredito: CuentaContable;
        let client: Cliente | null = item.facturaVenta.client;
        if (!client || !client.cuentaContableId) {
          client = await queryRunner.manager.findOne(Cliente, {
            where: { id: clienteId },
            relations: ['cuentaContable'],
          });
        }
        if (client?.cuentaContable) {
          cuentaCredito = client.cuentaContable;
        } else {
          const config = await this.parametrizacionService.getConfiguracion();
          if (config?.cuentaCobrarClientesId) {
            const temp = await queryRunner.manager.findOne(CuentaContable, {
              where: { id: config.cuentaCobrarClientesId },
            });
            cuentaCredito = temp || (await this.obtenerCuentaPorCodigo('1305'));
          } else {
            cuentaCredito = await this.obtenerCuentaPorCodigo('1305');
          }
        }

        detalles.push({
          cuentaId: cuentaCredito.id,
          debito: 0,
          credito: item.monto,
          descripcion: `Abono CxC - Fact: ${item.facturaVenta.comprobante_completo} | Cliente: ${client?.numeroDocumento ?? ''}`,
        });
      }

      const refStr = facturasAbonos.map(fa => fa.facturaVenta.comprobante_completo).join(', ');
      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.COBRO,
          fecha,
          referencia: refStr.substring(0, 100),
          descripcion: `Cobro Múltiple $${montoTotal.toLocaleString('es-CO')} - Facturas: ${refStr}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }
      return asiento;
    } catch (error) {
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error asiento cobro múltiple: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al generar asiento de cobro múltiple: ${error.message}`,
      );
    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
    }
  }

  async generarAsientoPagoCompraMultiple(
    params: {
      proveedorId: string;
      facturasAbonos: Array<{ facturaCompra: FacturaCompra; monto: number }>;
      montoTotal: number;
      fecha: Date;
      cuentaCreditoCodigo?: string;
      cuentaBancariaId?: string;
      medioPago?: string;
      userId: string;
    },
    qr?: QueryRunner,
  ): Promise<AsientoContable> {
    const { proveedorId, facturasAbonos, montoTotal, fecha, cuentaCreditoCodigo, cuentaBancariaId, medioPago, userId } = params;
    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      const cuentaCredito = await this.resolverCuentaTesoreria(
        { cuentaBancariaId, medioPago, fallbackCodigo: cuentaCreditoCodigo || '1110' },
        queryRunner,
      );

      const detalles: DetalleAsiento[] = [];
      const medioPagoLabel = cuentaCredito.codigo === '1105' ? 'Caja' : 'Banco';

      // 1. Crédito a Caja/Banco por el total pagado
      detalles.push({
        cuentaId: cuentaCredito.id,
        debito: 0,
        credito: montoTotal,
        descripcion: `Pago Múltiple desde ${medioPagoLabel}`,
      });

      // 2. Débito a la cuenta de proveedor de cada factura abonada
      for (const item of facturasAbonos) {
        let cuentaDebito: CuentaContable;
        let proveedor: Proveedor | null = item.facturaCompra.proveedor;
        if (!proveedor || !proveedor.cuentaContableId) {
          proveedor = await queryRunner.manager.findOne(Proveedor, {
            where: { id: proveedorId },
            relations: ['cuentaContable'],
          });
        }
        if (proveedor?.cuentaContable) {
          cuentaDebito = proveedor.cuentaContable;
        } else {
          const config = await this.parametrizacionService.getConfiguracion();
          if (config?.cuentaPagarProveedoresId) {
            const temp = await queryRunner.manager.findOne(CuentaContable, {
              where: { id: config.cuentaPagarProveedoresId },
            });
            cuentaDebito = temp || (await this.obtenerCuentaPorCodigo('2205'));
          } else {
            cuentaDebito = await this.obtenerCuentaPorCodigo('2205');
          }
        }

        detalles.push({
          cuentaId: cuentaDebito.id,
          debito: item.monto,
          credito: 0,
          descripcion: `Pago CxP - Compra: ${item.facturaCompra.numero} | Proveedor: ${proveedor?.identificacion ?? ''}`,
        });
      }

      const refStr = facturasAbonos.map(fa => fa.facturaCompra.numero).join(', ');
      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.PAGO_PROVEEDOR,
          fecha,
          referencia: refStr.substring(0, 100),
          descripcion: `Pago Múltiple $${montoTotal.toLocaleString('es-CO')} a proveedor - Facturas: ${refStr}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }
      return asiento;
    } catch (error) {
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error asiento pago múltiple: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al generar asiento de pago múltiple: ${error.message}`,
      );
    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
    }
  }

  async generarAsientoOtrosMovimientos(
    params: {
      tipoPago: TipoPago;
      conceptos: Array<{
        cuentaContableId: string;
        concepto: string;
        cantidad: number;
        valorUnitario: number;
        impuestoId?: string;
        impuestoPorcentaje?: number;
      }>;
      montoTotal: number;
      fecha: Date;
      cuentaBancariaId?: string;
      medioPago?: string;
      userId: string;
    },
    qr?: QueryRunner,
  ): Promise<AsientoContable> {
    const { tipoPago, conceptos, montoTotal, fecha, cuentaBancariaId, medioPago, userId } = params;
    const queryRunner = qr || this.dataSource.createQueryRunner();
    const isCustomRunner = !!qr;
    if (!isCustomRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      const isIngreso = tipoPago === TipoPago.OTRO_INGRESO;

      // 1. Obtener la cuenta de tesorería (Caja o Banco)
      const cuentaTesoreria = await this.resolverCuentaTesoreria(
        { cuentaBancariaId, medioPago, fallbackCodigo: isIngreso ? '1105' : '1110' },
        queryRunner,
      );

      const detalles: DetalleAsiento[] = [];
      const medioPagoLabel = cuentaTesoreria.codigo === '1105' ? 'Caja' : 'Banco';

      // 2. Línea de tesorería
      detalles.push({
        cuentaId: cuentaTesoreria.id,
        debito: isIngreso ? montoTotal : 0,
        credito: isIngreso ? 0 : montoTotal,
        descripcion: isIngreso ? `Otros ingresos en ${medioPagoLabel}` : `Otros egresos desde ${medioPagoLabel}`,
      });

      // 3. Procesar cada línea de concepto
      for (const c of conceptos) {
        const base = c.cantidad * c.valorUnitario;
        const porc = c.impuestoPorcentaje || 0;
        const impuestoMonto = base * (porc / 100);

        detalles.push({
          cuentaId: c.cuentaContableId,
          debito: isIngreso ? 0 : base,
          credito: isIngreso ? base : 0,
          descripcion: c.concepto,
        });

        // Si tiene impuesto, generar la línea contable correspondiente
        if (impuestoMonto > 0 && c.impuestoId) {
          const impuesto = await queryRunner.manager.findOne(Impuesto, {
            where: { id: c.impuestoId },
          });

          if (impuesto) {
            const cuentaImpuestoId = isIngreso ? impuesto.cuentaVentasId : impuesto.cuentaComprasId;
            if (cuentaImpuestoId) {
              detalles.push({
                cuentaId: cuentaImpuestoId,
                debito: isIngreso ? 0 : impuestoMonto,
                credito: isIngreso ? impuestoMonto : 0,
                descripcion: `IVA del ${porc}% - ${c.concepto}`,
              });
            }
          }
        }
      }

      const tipoAsiento = isIngreso ? TipoAsiento.COBRO : TipoAsiento.GASTO;
      const descripcionAsiento = isIngreso
        ? `Otros Ingresos directos - $${montoTotal.toLocaleString('es-CO')}`
        : `Otros Egresos directos - $${montoTotal.toLocaleString('es-CO')}`;

      const asiento = await this.crearAsiento(
        {
          tipo: tipoAsiento,
          fecha,
          referencia: isIngreso ? 'RC-OTROS' : 'CE-OTROS',
          descripcion: descripcionAsiento,
          detalles,
          userId,
        },
        queryRunner,
      );

      if (!isCustomRunner) {
        await queryRunner.commitTransaction();
      }
      return asiento;
    } catch (error) {
      if (!isCustomRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Error generando asiento de otros movimientos: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al generar asiento de otros movimientos: ${error.message}`,
      );
    } finally {
      if (!isCustomRunner) {
        await queryRunner.release();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY — mantenido por compatibilidad con facturas-ventas.service.ts
  // @deprecated Usar PagosService.registrarCobro() → generarAsientoCobro()
  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoPagoFacturaVenta(factura: FacturasVenta, userId: string): Promise<AsientoContable> {
    this.logger.warn(`[DEPRECATED] generarAsientoPagoFacturaVenta() → Migrar a PagosService.registrarCobro(). Factura: ${factura.comprobante_completo}`);
    return this.generarAsientoCobro({
      facturaVenta: factura,
      monto: factura.total,
      fecha: new Date(),
      cuentaDebitoCodigo: '1110',
      userId,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Dado el `codigo` del catálogo MetodoPago, retorna el código de cuenta PUC:
   *   - '1105' Caja     → si el pago es en efectivo
   *   - '1110' Bancos   → si el pago es por transferencia, consignación, tarjeta, cheque, etc.
   *
   * Si el código no está definido (contado sin método especificado) se asume efectivo (1105).
   */
  public async resolverCuentaContado(codigoMetodoPago?: string): Promise<string> {
    const config = await this.parametrizacionService.getConfiguracion();
    const METODOS_BANCO = ['47', '42', '49', '48', '20'];
    const esBanco =
      codigoMetodoPago && METODOS_BANCO.some((m) => codigoMetodoPago === m);

    const cuentaId = esBanco
      ? config.cuentaBancosDefectoId
      : config.cuentaCajaDefectoId;
    if (!cuentaId) {
      throw new Error('Falta parametrizar la cuenta por defecto para  en la Configuración Global.');
    }

    const cuenta = await this.cuentaRepository.findOne({
      where: { id: cuentaId },
    });
    if (!cuenta) {
      throw new Error('La cuenta configurada para  no existe o está inactiva.');
    }
    return cuenta.codigo;
  }

  private async resolverCuentaTesoreria(
    params: {
      cuentaBancariaId?: string;
      medioPago?: string;
      fallbackCodigo: string; // '1105' o '1110'
    },
    queryRunner: QueryRunner,
  ): Promise<CuentaContable> {
    const { cuentaBancariaId, medioPago, fallbackCodigo } = params;

    // 1. Si hay una cuenta bancaria seleccionada, buscarla y ver si tiene cuenta contable
    if (cuentaBancariaId) {
      const cuentaBancaria = await queryRunner.manager.findOne(CuentasBancarias, {
        where: { id: cuentaBancariaId },
      });
      if (cuentaBancaria && cuentaBancaria.codigoCuentaContable) {
        try {
          const cuenta = await this.cuentaRepository.findOne({
            where: { codigo: cuentaBancaria.codigoCuentaContable, isActive: true },
          });
          if (cuenta) return cuenta;
        } catch (e) {
          this.logger.warn(`Cuenta contable ${cuentaBancaria.codigoCuentaContable} configurada en banco no encontrada o inactiva.`);
        }
      }
    }

    // 2. Si no tiene cuenta contable o no se encontró, buscar en parametrización contable
    const config = await this.parametrizacionService.getConfiguracion();
    if (config) {
      const esCaja = medioPago === 'caja' || fallbackCodigo === '1105';
      const cuentaId = esCaja ? config.cuentaCajaDefectoId : config.cuentaBancosDefectoId;
      if (cuentaId) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        if (cuenta) return cuenta;
      }
    }

    // 3. Fallback final al código por defecto ('1105' o '1110')
    return this.obtenerCuentaPorCodigo(fallbackCodigo);
  }
  async crearAsientoDesdeDefinicion(definicion: DefinicionAsientoDto, userId: string, queryRunner: QueryRunner): Promise<AsientoContable> {
    const totalDebito = definicion.detalles.reduce((s, d) => s + d.debito, 0);
    const totalCredito = definicion.detalles.reduce((s, d) => s + d.credito, 0);

    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      throw new Error(`Asiento descuadrado [${definicion.tipo}]. Débito: ${totalDebito}, Crédito: ${totalCredito}`);
    }

    const numero = await this.generarNumeroAsiento(queryRunner);

    const asiento = queryRunner.manager.create(AsientoContable, {
      numero,
      tipo: definicion.tipo as TipoAsiento,
      fecha: definicion.fecha,
      referencia: definicion.referencia,
      descripcion: definicion.descripcion,
      totalDebito,
      totalCredito,
      createdById: userId,
    });

    const asientoGuardado = await queryRunner.manager.save(AsientoContable, asiento);

    for (const detalle of definicion.detalles) {
      let clienteId = detalle.clienteId;
      let proveedorId = detalle.proveedorId;

      if (!clienteId && !proveedorId && detalle.terceroId) {
        const esVenta = [
          TipoAsiento.FACTURA_VENTA,
          TipoAsiento.ANULACION_FACTURA_VENTA,
          TipoAsiento.COBRO,
          TipoAsiento.ANULACION_COBRO,
          TipoAsiento.NOTA_CREDITO_VENTA,
          TipoAsiento.NOTA_DEBITO_VENTA,
        ].includes(definicion.tipo as TipoAsiento);

        const esCompra = [
          TipoAsiento.GASTO,
          TipoAsiento.ANULACION_FACTURA_COMPRA,
          TipoAsiento.PAGO_PROVEEDOR,
          TipoAsiento.ANULACION_PAGO_PROVEEDOR,
          TipoAsiento.NOTA_CREDITO_COMPRA,
          TipoAsiento.NOTA_DEBITO_COMPRA,
          TipoAsiento.ANULACION_NOTA_COMPRA,
        ].includes(definicion.tipo as TipoAsiento);

        if (esVenta) {
          clienteId = detalle.terceroId;
        } else if (esCompra) {
          proveedorId = detalle.terceroId;
        }
      }

      const detalleAsiento = queryRunner.manager.create(AsientoDetalle, {
        asientoId: asientoGuardado.id,
        cuentaId: detalle.cuentaId,
        debito: detalle.debito,
        credito: detalle.credito,
        descripcion: detalle.concepto,
        clienteId,
        proveedorId,
        entidadSSId: detalle.entidadSSId,
        centroCostoId: detalle.centroCostoId,
        baseGravable: detalle.baseGravable,
        impuestoId: detalle.impuestoId,
        porcentajeImpuesto: detalle.porcentajeImpuesto,
        tipoImpuesto: detalle.tipoImpuesto,
        documentoReferencia: detalle.documentoReferencia,
      });
      await queryRunner.manager.save(AsientoDetalle, detalleAsiento);
    }

    return asientoGuardado;
  }

  private async crearAsiento(
    data: {
      tipo: TipoAsiento;
      fecha: Date;
      referencia: string;
      descripcion: string;
      detalles: DetalleAsiento[];
      userId: string;
    },
    queryRunner: any,
  ): Promise<AsientoContable> {
    const totalDebito = data.detalles.reduce((s, d) => s + d.debito, 0);
    const totalCredito = data.detalles.reduce((s, d) => s + d.credito, 0);

    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      throw new Error(
        `Asiento descuadrado [${data.tipo}]. Débito: ${totalDebito}, Crédito: ${totalCredito}`,
      );
    }

    const numero = await this.generarNumeroAsiento(queryRunner);

    const asiento = queryRunner.manager.create(AsientoContable, {
      numero,
      tipo: data.tipo,
      fecha: data.fecha,
      referencia: data.referencia,
      descripcion: data.descripcion,
      totalDebito,
      totalCredito,
      createdById: data.userId,
    });

    const asientoGuardado = await queryRunner.manager.save(
      AsientoContable,
      asiento,
    );

    for (const detalle of data.detalles) {
      const detalleAsiento = queryRunner.manager.create(AsientoDetalle, {
        asientoId: asientoGuardado.id,
        cuentaId: detalle.cuentaId,
        debito: detalle.debito,
        credito: detalle.credito,
        descripcion: detalle.descripcion,
        clienteId: detalle.clienteId,
        proveedorId: detalle.proveedorId,
        centroCostoId: detalle.centroCostoId,
        baseGravable: detalle.baseGravable,
        impuestoId: detalle.impuestoId,
        porcentajeImpuesto: detalle.porcentajeImpuesto,
        tipoImpuesto: detalle.tipoImpuesto,
        documentoReferencia: detalle.documentoReferencia,
      });
      await queryRunner.manager.save(AsientoDetalle, detalleAsiento);
    }

    return asientoGuardado;
  }

  async generarAsientoNotaAjusteCompra(
    nota: NotaAjusteCompra,
    userId: string,
  ): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = nota.facturaOriginal;
      const isNotaCredito = nota.tipo === TipoNotaCompra.CREDITO;
      const detalles: DetalleAsiento[] = [];

      // 1. Agrupar gastos e iva
      const gastosAgrupados = new Map<string, number>();
      const ivaAgrupados = new Map<string, number>();

      for (const item of nota.items) {
        if (!item.articuloId) continue;
        const articulo = await queryRunner.manager.findOne(Articulo, {
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
            `Artículo no tiene cuenta contable principal configurada`,
          );
        }

        const cuentaId = articulo.categoriaArticulo.cuentaPrincipalId;
        const valorGasto = Number(item.subtotal) - Number(item.valorDescuento);
        gastosAgrupados.set(
          cuentaId,
          (gastosAgrupados.get(cuentaId) ?? 0) + valorGasto,
        );

        const valorIva = Number(item.valorIVA) || 0;
        if (valorIva > 0) {
          const ivaPorcentaje = item.porcentajeIVA || 0;
          const cuentaIvaPorcentaje = await this.obtenerCuentaImpuesto({
            impuestoId: (item as any).impuestoId,
            tarifa: item.porcentajeIVA || 0,
            tipo: 'IVA',
            operacion: 'compras',
          });
          let cuentaIvaId: string;
          if (cuentaIvaPorcentaje) {
            cuentaIvaId = cuentaIvaPorcentaje.id;
          } else if (articulo.impuestoRel?.cuentaComprasId) {
            cuentaIvaId = articulo.impuestoRel.cuentaComprasId;
          } else {
            cuentaIvaId = '1355';
          }
          ivaAgrupados.set(
            cuentaIvaId,
            (ivaAgrupados.get(cuentaIvaId) ?? 0) + valorIva,
          );
        }
      }

      // Para Nota Crédito de Compra: se revierte el gasto
      // Crédito: Gasto (para NC) | Débito: Gasto (para ND)
      for (const [cuentaId, valor] of gastosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        detalles.push({
          cuentaId,
          debito: isNotaCredito ? 0 : valor,
          credito: isNotaCredito ? valor : 0,
          descripcion: `${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} Gasto - ${cuenta?.nombre} | Nota: ${nota.numeroCompleto}`,
        });
      }

      // Para Nota Crédito de Compra: se revierte el IVA descontable
      // Crédito: IVA (para NC) | Débito: IVA (para ND)
      for (const [cuentaId, valor] of ivaAgrupados) {
        detalles.push({
          cuentaId,
          debito: isNotaCredito ? 0 : valor,
          credito: isNotaCredito ? valor : 0,
          descripcion: `${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} IVA Descontable | Nota: ${nota.numeroCompleto}`,
        });
      }

      // Contrapartida: CxP o Bancos/Caja
      // Débito: CxP (para NC) | Crédito: CxP (para ND)
      const isContado = factura.formaPago === FormaPago.CONTADO;
      let codigoCxP = '2205';
      if (gastosAgrupados.size > 0) {
        const cuentasInvolucradas = await queryRunner.manager.find(
          CuentaContable,
          { where: { id: In(Array.from(gastosAgrupados.keys())) } },
        );
        if (cuentasInvolucradas.some((c) => c.codigo.startsWith('5'))) {
          codigoCxP = '2335';
        }
      }

      const codigoCuentaContra = isContado
        ? factura.cuentaBancaria?.codigoCuentaContable
          ? factura.cuentaBancaria.codigoCuentaContable
          : await this.resolverCuentaContado(factura.metodoPago!)
        : codigoCxP;
      const cuentaContra =
        await this.obtenerCuentaPorCodigo(codigoCuentaContra);

      detalles.push({
        cuentaId: cuentaContra.id,
        debito: isNotaCredito ? Number(nota.total) : 0,
        credito: isNotaCredito ? 0 : Number(nota.total),
        descripcion: `${isNotaCredito ? 'DÉBITO' : 'CRÉDITO'} Proveedor/Caja Fact: ${factura.numero} | Nota: ${nota.numeroCompleto}`,
      });

      const asiento = await this.crearAsiento(
        {
          tipo: isNotaCredito
            ? TipoAsiento.NOTA_CREDITO_COMPRA
            : TipoAsiento.NOTA_DEBITO_COMPRA,
          fecha: nota.fecha,
          referencia: nota.numeroCompleto,
          descripcion: `Asiento automático - ${isNotaCredito ? 'Nota Crédito' : 'Nota Débito'} Compra ${nota.numeroCompleto}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asiento nota compra: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async generarAsientoAnulacionNotaAjusteCompra(
    notaId: string,
  ): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nota = await queryRunner.manager.findOne(NotaAjusteCompra, {
        where: { id: notaId },
        relations: ['facturaOriginal', 'items'],
      });

      if (!nota)
        throw new Error(`Nota de ajuste compra ${notaId} no encontrada`);

      const factura = nota.facturaOriginal;
      const isNotaCredito = nota.tipo === TipoNotaCompra.CREDITO;
      const detalles: DetalleAsiento[] = [];

      // 1. Agrupar gastos e iva
      const gastosAgrupados = new Map<string, number>();
      const ivaAgrupados = new Map<string, number>();

      for (const item of nota.items) {
        if (!item.articuloId) continue;
        const articulo = await queryRunner.manager.findOne(Articulo, {
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
            `Artículo no tiene cuenta contable principal configurada`,
          );
        }

        const cuentaId = articulo.categoriaArticulo.cuentaPrincipalId;
        const valorGasto = Number(item.subtotal) - Number(item.valorDescuento);
        gastosAgrupados.set(
          cuentaId,
          (gastosAgrupados.get(cuentaId) ?? 0) + valorGasto,
        );

        const valorIva = Number(item.valorIVA) || 0;
        if (valorIva > 0) {
          const ivaPorcentaje = item.porcentajeIVA || 0;
          const cuentaIvaPorcentaje = await this.obtenerCuentaImpuesto({
            impuestoId: (item as any).impuestoId,
            tarifa: item.porcentajeIVA || 0,
            tipo: 'IVA',
            operacion: 'compras',
          });
          let cuentaIvaId: string;
          if (cuentaIvaPorcentaje) {
            cuentaIvaId = cuentaIvaPorcentaje.id;
          } else if (articulo.impuestoRel?.cuentaComprasId) {
            cuentaIvaId = articulo.impuestoRel.cuentaComprasId;
          } else {
            cuentaIvaId = '1355';
          }
          ivaAgrupados.set(
            cuentaIvaId,
            (ivaAgrupados.get(cuentaIvaId) ?? 0) + valorIva,
          );
        }
      }

      // Revertir (invertir débitos y créditos del asiento original)
      // Para Nota Crédito original: Gasto fue Crédito -> Ahora es Débito
      for (const [cuentaId, valor] of gastosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        detalles.push({
          cuentaId,
          debito: isNotaCredito ? valor : 0,
          credito: isNotaCredito ? 0 : valor,
          descripcion: `ANULACIÓN - ${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} Gasto - ${cuenta?.nombre} | Nota: ${nota.numeroCompleto}`,
        });
      }

      for (const [cuentaId, valor] of ivaAgrupados) {
        detalles.push({
          cuentaId,
          debito: isNotaCredito ? valor : 0,
          credito: isNotaCredito ? 0 : valor,
          descripcion: `ANULACIÓN - ${isNotaCredito ? 'REVERSIÓN' : 'ADICIÓN'} IVA Descontable | Nota: ${nota.numeroCompleto}`,
        });
      }

      const isContado = factura.formaPago === FormaPago.CONTADO;
      let codigoCxP = '2205';
      if (gastosAgrupados.size > 0) {
        const cuentasInvolucradas = await queryRunner.manager.find(
          CuentaContable,
          { where: { id: In(Array.from(gastosAgrupados.keys())) } },
        );
        if (cuentasInvolucradas.some((c) => c.codigo.startsWith('5'))) {
          codigoCxP = '2335';
        }
      }

      const codigoCuentaContra = isContado
        ? factura.cuentaBancaria?.codigoCuentaContable
          ? factura.cuentaBancaria.codigoCuentaContable
          : await this.resolverCuentaContado(factura.metodoPago!)
        : codigoCxP;
      const cuentaContra =
        await this.obtenerCuentaPorCodigo(codigoCuentaContra);

      // Para Nota Crédito original: CxP fue Débito -> Ahora es Crédito
      detalles.push({
        cuentaId: cuentaContra.id,
        debito: isNotaCredito ? 0 : Number(nota.total),
        credito: isNotaCredito ? Number(nota.total) : 0,
        descripcion: `ANULACIÓN - ${isNotaCredito ? 'DÉBITO' : 'CRÉDITO'} Proveedor/Caja Fact: ${factura.numero} | Nota: ${nota.numeroCompleto}`,
      });

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.ANULACION_NOTA_COMPRA,
          fecha: new Date(),
          referencia: nota.numeroCompleto,
          descripcion: `Asiento automático - Anulación Nota Compra ${nota.numeroCompleto}`,
          detalles,
          userId: nota.createdById,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asiento anulación nota compra: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  public async obtenerCuentaPorCodigo(
    codigo: string,
  ): Promise<CuentaContable> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { codigo, isActive: true },
    });
    if (!cuenta) {
      throw new Error(`Cuenta contable '${codigo}' no encontrada o inactiva`);
    }
    return cuenta;
  }

  public async obtenerCuentaPorId(
    id: string,
  ): Promise<CuentaContable | null> {
    return await this.cuentaRepository.findOne({
      where: { id },
    });
  }

  async generarAsientoSaldoInicial(params: {
    nombreCuenta: string;
    monto: number;
    cuentaContrapartidaCodigo: string;
    userId: string;
  }): Promise<AsientoContable> {
    const { nombreCuenta, monto, cuentaContrapartidaCodigo, userId } = params;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuentaBancos = await this.obtenerCuentaPorCodigo('1110');
      const cuentaContrapartida = await this.obtenerCuentaPorCodigo(
        cuentaContrapartidaCodigo,
      );

      const detalles: DetalleAsiento[] = [
        {
          cuentaId: cuentaBancos.id,
          debito: monto,
          credito: 0,
          descripcion: `Saldo inicial - ${nombreCuenta}`,
        },
        {
          cuentaId: cuentaContrapartida.id,
          debito: 0,
          credito: monto,
          descripcion: `Contrapartida saldo inicial - ${nombreCuenta}`,
        },
      ];

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.SALDO_INICIAL_BANCO,
          fecha: new Date(),
          referencia: nombreCuenta,
          descripcion: `Saldo inicial de cuenta bancaria ${nombreCuenta} por $${monto.toLocaleString('es-CO')}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Asiento SALDO_INICIAL generado: ${asiento.numero} | $${monto} | ${nombreCuenta}`,
      );
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asiento saldo inicial: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al generar asiento de saldo inicial: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async generarAsientoTransferencia(params: {
    nombreOrigen: string;
    nombreDestino: string;
    monto: number;
    userId: string;
  }): Promise<AsientoContable> {
    const { nombreOrigen, nombreDestino, monto, userId } = params;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuentaBancos = await this.obtenerCuentaPorCodigo('1110');

      const detalles: DetalleAsiento[] = [
        {
          cuentaId: cuentaBancos.id,
          debito: monto,
          credito: 0,
          descripcion: `Transferencia recibida - ${nombreDestino}`,
        },
        {
          cuentaId: cuentaBancos.id,
          debito: 0,
          credito: monto,
          descripcion: `Transferencia enviada - ${nombreOrigen}`,
        },
      ];

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.TRANSFERENCIA_BANCARIA,
          fecha: new Date(),
          referencia: `${nombreOrigen} -> ${nombreDestino}`,
          descripcion: `Transferencia de ${nombreOrigen} a ${nombreDestino} por $${monto.toLocaleString('es-CO')}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Asiento TRANSFERENCIA generado: ${asiento.numero} | $${monto} | ${nombreOrigen} -> ${nombreDestino}`,
      );
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asiento transferencia: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al generar asiento de transferencia: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Busca la cuenta contable configurada para un impuesto.
   * Prioriza búsqueda por impuestoId (UUID), con fallback por tarifa + tipo.
   */
  public async obtenerCuentaImpuesto(params: {
    impuestoId?: string;
    tarifa?: number;
    tipo?: string;
    operacion: 'ventas' | 'compras';
  }): Promise<CuentaContable> {
    let impuesto: Impuesto | null = null;

    if (params.impuestoId) {
      impuesto = await this.impuestoRepository.findOne({
        where: { id: params.impuestoId, activo: true },
        relations: ['cuentaVentas', 'cuentaCompras'],
      });
    }

    if (!impuesto && params.tarifa !== undefined && params.tipo) {
      impuesto = await this.impuestoRepository.findOne({
        where: { tarifa: params.tarifa, tipo: params.tipo, activo: true },
        relations: ['cuentaVentas', 'cuentaCompras'],
      });
    }

    if (params.operacion === 'ventas' && impuesto?.cuentaVentas) {
      return impuesto.cuentaVentas;
    }

    if (params.operacion === 'compras' && impuesto?.cuentaCompras) {
      return impuesto.cuentaCompras;
    }

    const fallbackCodigo = params.operacion === 'ventas' ? '2408' : '1355';
    this.logger.warn(
      `No se encontró configuración de cuenta para impuesto ${params.impuestoId || `${params.tipo} ${params.tarifa}%`}. Usando fallback ${fallbackCodigo}`,
    );
    return this.obtenerCuentaPorCodigo(fallbackCodigo);
  }

  async generarAsientoNomina(params: {
    periodoNombre: string;
    fecha: Date;
    totalDevengado: number;
    totalProvisiones: number;
    totalAportes: number;
    netoPagar: number;
    saludPensionEmpleado: number;
    retencionFuente: number;
    userId: string;
    detallesCustom?: { cuentaId: string; debito: number; credito: number; descripcion: string }[];
  }): Promise<AsientoContable> {
    const {
      periodoNombre,
      fecha,
      totalDevengado,
      totalProvisiones,
      totalAportes,
      netoPagar,
      saludPensionEmpleado,
      retencionFuente,
      userId,
      detallesCustom,
    } = params;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let detalles: DetalleAsiento[] = [];

      if (detallesCustom && detallesCustom.length > 0) {
        detalles = detallesCustom;
      } else {
        const cuentaGastosPersonal = await this.obtenerCuentaPorCodigo('5105');
        const cuentaPrestaciones = await this.obtenerCuentaPorCodigo('5110');
        const cuentaAportesParafiscales =
          await this.obtenerCuentaPorCodigo('5115');
        const cuentaObligacionesLab = await this.obtenerCuentaPorCodigo('2610');
        const cuentaRetencionNomina = await this.obtenerCuentaPorCodigo('2370');
        const cuentaRetefuente = await this.obtenerCuentaPorCodigo('2365');
        const cuentaAportesXPagar = await this.obtenerCuentaPorCodigo('2368');

        detalles = [
          {
            cuentaId: cuentaGastosPersonal.id,
            debito: totalDevengado,
            credito: 0,
            descripcion: 'Sueldos y salarios',
          },
          {
            cuentaId: cuentaPrestaciones.id,
            debito: totalProvisiones,
            credito: 0,
            descripcion: 'Prestaciones sociales',
          },
          {
            cuentaId: cuentaAportesParafiscales.id,
            debito: totalAportes,
            credito: 0,
            descripcion: 'Aportes parafiscales',
          },
          {
            cuentaId: cuentaObligacionesLab.id,
            debito: 0,
            credito: netoPagar + totalProvisiones,
            descripcion: 'Obligaciones laborales',
          },
          {
            cuentaId: cuentaRetencionNomina.id,
            debito: 0,
            credito: saludPensionEmpleado,
            descripcion: 'Retenciones salud y pensión',
          },
          {
            cuentaId: cuentaRetefuente.id,
            debito: 0,
            credito: retencionFuente,
            descripcion: 'Retención en la fuente',
          },
          {
            cuentaId: cuentaAportesXPagar.id,
            debito: 0,
            credito: totalAportes,
            descripcion: 'Aportes parafiscales por pagar',
          },
        ];
      }

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.NOMINA,
          fecha,
          referencia: periodoNombre,
          descripcion: `Provisión nómina - ${periodoNombre}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento NOMINA generado: ${asiento.numero} | ${periodoNombre}`);
      return asiento;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error asiento nómina: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al generar asiento de nómina: ${error.message}`);

    } finally {
      await queryRunner.release();
    }
  }

  async generarAsientoPagoNomina(params: {
    periodoNombre: string;
    fecha: Date;
    netoPagar: number;
    cuentaCodigoContable: string;
    userId: string;
  }): Promise<AsientoContable> {
    const { periodoNombre, fecha, netoPagar, cuentaCodigoContable, userId } =
      params;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuentaObligacionesLab = await this.obtenerCuentaPorCodigo('2610');
      const cuentaBanco =
        await this.obtenerCuentaPorCodigo(cuentaCodigoContable);

      const detalles: DetalleAsiento[] = [
        {
          cuentaId: cuentaObligacionesLab.id,
          debito: netoPagar,
          credito: 0,
          descripcion: 'Pago nómina',
        },
        {
          cuentaId: cuentaBanco.id,
          debito: 0,
          credito: netoPagar,
          descripcion: `Pago nómina ${periodoNombre}`,
        },
      ];

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.PAGO_NOMINA,
          fecha,
          referencia: periodoNombre,
          descripcion: `Pago nómina - ${periodoNombre}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Asiento PAGO_NOMINA generado: ${asiento.numero} | ${periodoNombre}`,
      );
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error asiento pago nómina: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al generar asiento de pago de nómina: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async anularAsientoNomina(params: {
    periodoNombre: string;
    fecha: Date;
    asientoOriginal: AsientoContable;
    userId: string;
  }): Promise<AsientoContable> {
    const { periodoNombre, fecha, asientoOriginal, userId } = params;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = asientoOriginal.detalles.map((d) => ({
        cuentaId: d.cuentaId,
        debito: d.credito,
        credito: d.debito,
        descripcion: `ANULACIÓN: ${d.descripcion}`,
      }));

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.ANULACION_NOMINA,
          fecha,
          referencia: `${periodoNombre} (anula #${asientoOriginal.numero})`,
          descripcion: `Anulación provisión nómina - ${periodoNombre}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Asiento ANULACION_NOMINA generado: ${asiento.numero} | ${periodoNombre}`,
      );
      return asiento;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error anulación asiento nómina: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al anular asiento de nómina: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findOneAsientoConDetalles(id: string): Promise<AsientoContable> {
    const asiento = await this.asientoRepository.findOne({
      where: { id },
      relations: ['detalles', 'detalles.cuenta'],
    });
    if (!asiento) {
      throw new Error(`Asiento contable '${id}' no encontrado`);
    }
    return asiento;
  }

  async generarAsientoCruceAnticipo(
    data: {
      tipo: 'venta' | 'compra';
      cuentaTerceroId: string;
      cuentaAnticipoId: string;
      monto: number;
      fecha: Date;
      referencia: string;
      descripcion: string;
      terceroId: string;
      userId: string;
    },
    queryRunner: QueryRunner,
  ): Promise<AsientoContable> {
    const cuentaTercero = await queryRunner.manager.findOne(CuentaContable, { where: { id: data.cuentaTerceroId } });
    const cuentaAnticipo = await queryRunner.manager.findOne(CuentaContable, { where: { id: data.cuentaAnticipoId } });

    if (!cuentaTercero) {
      throw new NotFoundException(`Cuenta de control de tercero no encontrada`);
    }
    if (!cuentaAnticipo) {
      throw new NotFoundException(`Cuenta de anticipo no encontrada`);
    }

    const detalles: any[] = [];
    const debitoMonto = Number(data.monto);
    const creditoMonto = Number(data.monto);

    if (data.tipo === 'venta') {
      // VENTA:
      // Débito: Anticipo Clientes (Pasivo)
      // Crédito: Clientes Nacionales (Activo)
      detalles.push({
        cuentaId: cuentaAnticipo.id,
        cuentaCodigo: cuentaAnticipo.codigo,
        cuentaNombre: cuentaAnticipo.nombre,
        debito: debitoMonto,
        credito: 0,
        concepto: data.descripcion,
        terceroId: data.terceroId,
      });
      detalles.push({
        cuentaId: cuentaTercero.id,
        cuentaCodigo: cuentaTercero.codigo,
        cuentaNombre: cuentaTercero.nombre,
        debito: 0,
        credito: creditoMonto,
        concepto: data.descripcion,
        terceroId: data.terceroId,
      });
    } else {
      // COMPRA:
      // Débito: Proveedores (Pasivo)
      // Crédito: Anticipo Proveedores (Activo)
      detalles.push({
        cuentaId: cuentaTercero.id,
        cuentaCodigo: cuentaTercero.codigo,
        cuentaNombre: cuentaTercero.nombre,
        debito: debitoMonto,
        credito: 0,
        concepto: data.descripcion,
        terceroId: data.terceroId,
      });
      detalles.push({
        cuentaId: cuentaAnticipo.id,
        cuentaCodigo: cuentaAnticipo.codigo,
        cuentaNombre: cuentaAnticipo.nombre,
        debito: 0,
        credito: creditoMonto,
        concepto: data.descripcion,
        terceroId: data.terceroId,
      });
    }

    const definicion: DefinicionAsientoDto = {
      tipo: TipoAsiento.CRUCE_ANTICIPO,
      fecha: data.fecha,
      referencia: data.referencia,
      descripcion: data.descripcion,
      detalles,
      totalDebito: debitoMonto,
      totalCredito: creditoMonto,
      estaBalanceado: true,
      diferencia: 0,
    };

    const asientoCruce = await this.crearAsientoDesdeDefinicion(definicion, data.userId, queryRunner);

    // Generar el ComprobanteContable asociado
    const tipoCruce = await this.obtenerTipoComprobanteCruce(queryRunner.manager);
    const consecutivoStr = String(tipoCruce.consecutivoActual).padStart(4, '0');
    const numeroComp = tipoCruce.prefijo ? `${tipoCruce.prefijo}-${consecutivoStr}` : consecutivoStr;

    tipoCruce.consecutivoActual += 1;
    await queryRunner.manager.save(TipoComprobante, tipoCruce);

    const comprobante = queryRunner.manager.create(ComprobanteContable, {
      tipoComprobanteId: tipoCruce.id,
      numero: numeroComp,
      fechaDocumento: data.fecha,
      fechaContabilizacion: new Date(),
      estado: EstadoComprobante.CONTABILIZADO,
      totalDebito: debitoMonto,
      totalCredito: creditoMonto,
      asientoId: asientoCruce.id,
      observaciones: data.descripcion,
      creadoPorId: data.userId,
    });

    const guardado = await queryRunner.manager.save(ComprobanteContable, comprobante);

    // Crear los ComprobanteDetalle correspondientes
    for (const d of detalles) {
      const detail = queryRunner.manager.create(ComprobanteDetalle, {
        comprobanteId: guardado.id,
        cuentaContableId: d.cuentaId,
        descripcion: d.concepto,
        debito: d.debito,
        credito: d.credito,
        clienteId: data.tipo === 'venta' ? data.terceroId : undefined,
        proveedorId: data.tipo === 'compra' ? data.terceroId : undefined,
      });
      await queryRunner.manager.save(ComprobanteDetalle, detail);
    }

    return asientoCruce;
  }

  private async obtenerTipoComprobanteCruce(manager: any): Promise<TipoComprobante> {
    let tipo = await manager.findOne(TipoComprobante, { where: { codigo: 'CC' } });
    if (!tipo) {
      tipo = await manager.findOne(TipoComprobante, { where: { codigo: 'DIARIO' } });
    }
    if (!tipo) {
      tipo = manager.create(TipoComprobante, {
        codigo: 'CC',
        nombre: 'Cruce de Anticipos',
        prefijo: 'CC',
        consecutivoActual: 1,
        numeracionAutomatica: true,
        activo: true,
      });
      tipo = await manager.save(TipoComprobante, tipo);
    }
    return tipo;
  }

  async anularAsiento(
    asientoId: string,
    tipoAnulacion: TipoAsiento,
    userId: string,
    queryRunner: QueryRunner,
  ): Promise<AsientoContable> {
    const asientoOriginal = await queryRunner.manager.findOne(AsientoContable, {
      where: { id: asientoId },
      relations: ['detalles', 'detalles.cuenta'],
    });

    if (!asientoOriginal) {
      throw new NotFoundException(`Asiento original con ID ${asientoId} no encontrado`);
    }

    const detalles = asientoOriginal.detalles.map((d) => ({
      cuentaId: d.cuentaId,
      cuentaCodigo: d.cuenta?.codigo,
      cuentaNombre: d.cuenta?.nombre,
      debito: Number(d.credito),
      credito: Number(d.debito),
      concepto: `ANULACIÓN: ${d.descripcion}`,
      terceroId: d.clienteId || d.proveedorId || undefined,
    }));

    const definicion: DefinicionAsientoDto = {
      tipo: tipoAnulacion,
      fecha: new Date(),
      referencia: asientoOriginal.referencia,
      descripcion: `Anulación del asiento #${asientoOriginal.numero}`,
      detalles,
      totalDebito: asientoOriginal.totalCredito,
      totalCredito: asientoOriginal.totalDebito,
      estaBalanceado: true,
      diferencia: 0,
    };

    const asientoReverso = await this.crearAsientoDesdeDefinicion(definicion, userId, queryRunner);

    // Si hay un comprobante contable asociado, anularlo también
    const comprobante = await queryRunner.manager.findOne(ComprobanteContable, {
      where: { asientoId: asientoOriginal.id },
    });
    if (comprobante) {
      comprobante.estado = EstadoComprobante.ANULADO;
      comprobante.fechaAnulacion = new Date();
      comprobante.anuladoPorId = userId;
      comprobante.motivoAnulacion = `Anulado automáticamente por anulación de factura/compra`;
      await queryRunner.manager.save(ComprobanteContable, comprobante);
    }

    return asientoReverso;
  }

  private async generarNumeroAsiento(queryRunner: any): Promise<string> {
    const ultimoAsiento = await queryRunner.manager.findOne(AsientoContable, {
      where: {},
      order: { createdAt: 'DESC' },
    });
    const ultimoNumero = ultimoAsiento ? parseInt(ultimoAsiento.numero) : 0;
    return (ultimoNumero + 1).toString().padStart(8, '0');
  }
}
