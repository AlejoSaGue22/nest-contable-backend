import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AsientoContable, TipoAsiento } from './entities/asientos-contable.entity';
import { DataSource, Repository } from 'typeorm';
import { AsientoDetalle } from './entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { FacturasVenta, FormaPago } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';

interface DetalleAsiento {
  cuentaId: string;
  debito: number;
  credito: number;
  descripcion: string;
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

    private dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // 1. FACTURA DE VENTA
  //
  // CONTADO:  DÉBITO Caja 1105       | CRÉDITO Ingresos (x artículo) + IVA 2408
  // CRÉDITO:  DÉBITO Clientes 1305   | CRÉDITO Ingresos (x artículo) + IVA 2408
  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoFacturaVenta(
    factura: FacturasVenta,
    userId: string,
  ): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = [];

      // ── Débito: Caja (contado) o Clientes (crédito) ──────────────────
      const isContado  = factura.formaPago === FormaPago.CONTADO;
      const codigoDebito = isContado ? '1105' : '1305';
      const cuentaDebito = await this.obtenerCuentaPorCodigo(codigoDebito);

      detalles.push({
        cuentaId:    cuentaDebito.id,
        debito:      factura.total,
        credito:     0,
        descripcion: `Factura venta ${factura.comprobante_completo} - ${factura.formaPago}`,
      });

      // ── Crédito: Ingresos agrupados por cuenta del artículo ──────────
      const ingresosAgrupados = new Map<string, number>();

      for (const item of factura.items) {
        const producto = await queryRunner.manager.findOne(Articulo, {
          where: { id: item.articuloId },
          relations: ['cuentaContable'],
        });

        if (!producto?.cuentaContable) {
          throw new Error(`Artículo ${item.articuloId} no tiene cuenta contable configurada`);
        }

        const cuentaId = producto.cuentaContableId;
        ingresosAgrupados.set(
          cuentaId,
          (ingresosAgrupados.get(cuentaId) ?? 0) + item.subtotal,
        );
      }

      for (const [cuentaId, valor] of ingresosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        if (!cuenta) throw new Error(`Cuenta contable ${cuentaId} no encontrada`);

        detalles.push({
          cuentaId,
          debito:      0,
          credito:     valor,
          descripcion: `Ingreso por ${cuenta.nombre}`,
        });
      }

      // ── Crédito: IVA por Pagar ────────────────────────────────────────
      if (factura.iva > 0) {
        const cuentaIva = await this.obtenerCuentaPorCodigo('2408');
        detalles.push({
          cuentaId:    cuentaIva.id,
          debito:      0,
          credito:     factura.iva,
          descripcion: 'IVA generado en venta',
        });
      }

      // ── Débito: Descuentos (si aplica) ───────────────────────────────
      if (factura.descuento > 0) {
        const cuentaDescuento = await this.obtenerCuentaPorCodigo('5305');
        detalles.push({
          cuentaId:    cuentaDescuento.id,
          debito:      factura.descuento,
          credito:     0,
          descripcion: 'Descuento otorgado en venta',
        });
      }

      const asiento = await this.crearAsiento(
        {
          tipo:        TipoAsiento.FACTURA_VENTA,
          fecha:       factura.fecha,
          referencia:  factura.comprobante_completo,
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
      this.logger.error(`Error asiento factura venta: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar asiento contable');
    } finally {
      await queryRunner.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. GASTO / FACTURA DE COMPRA
  //
  // CONTADO: DÉBITO Gastos (x artículo) + IVA 1355  |  CRÉDITO Caja 1105
  // CRÉDITO: DÉBITO Gastos (x artículo) + IVA 1355  |  CRÉDITO Proveedores 2205
  // ══════════════════════════════════════════════════════════════════════════
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

      for (const item of gasto.items) {
        const articulo = await queryRunner.manager.findOne(Articulo, {
          where: { id: item.articuloId },
          relations: ['cuentaContable'],
        });

        if (!articulo?.cuentaContable) {
          throw new Error(`Artículo ${item.articuloId} no tiene cuenta contable configurada`);
        }

        const cuentaId = articulo.cuentaContableId;
        gastosAgrupados.set(
          cuentaId,
          (gastosAgrupados.get(cuentaId) ?? 0) + item.valorSubtotal,
        );
      }

      for (const [cuentaId, valor] of gastosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId },
        });
        detalles.push({
          cuentaId,
          debito:      valor,
          credito:     0,
          descripcion: `Gasto - ${cuenta?.nombre}`,
        });
      }

      // ── Débito: IVA Descontable ───────────────────────────────────────
      if (gasto.iva > 0) {
        const cuentaIva = await this.obtenerCuentaPorCodigo('1355');
        detalles.push({
          cuentaId:    cuentaIva.id,
          debito:      gasto.iva,
          credito:     0,
          descripcion: 'IVA descontable en compra',
        });
      }

      // ── Crédito: Caja (contado) o Proveedores (crédito) ─────────────
      const isContado      = gasto.formaPago === 'CONTADO';
      const codigoCredito  = isContado ? '1105' : '2205';
      const descCredito    = isContado
        ? `Pago contado - Proveedor: ${gasto.proveedorId}`
        : `Deuda con proveedor - Compra: ${gasto.numero}`;

      const cuentaCredito = await this.obtenerCuentaPorCodigo(codigoCredito);
      detalles.push({
        cuentaId:    cuentaCredito.id,
        debito:      0,
        credito:     gasto.total,
        descripcion: descCredito,
      });

      const asiento = await this.crearAsiento(
        {
          tipo:        TipoAsiento.GASTO,
          fecha:       gasto.fecha,
          referencia:  gasto.numero,
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
      throw new InternalServerErrorException('Error al generar asiento contable de gasto');
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

      // ── Crédito: reversa de Caja / Clientes ──────────────────────────
      const isContado    = factura.formaPago === FormaPago.CONTADO;
      const codigoDebito = isContado ? '1105' : '1305';
      const cuentaDebito = await this.obtenerCuentaPorCodigo(codigoDebito);

      detalles.push({
        cuentaId:    cuentaDebito.id,
        debito:      0,
        credito:     factura.total,
        descripcion: `ANULACIÓN - Factura ${factura.comprobante_completo}`,
      });

      // ── Débito: reversa de Ingresos ───────────────────────────────────
      const ingresosAgrupados = new Map<string, number>();

      for (const item of factura.items) {
        const producto = await queryRunner.manager.findOne(Articulo, {
          where: { id: item.articuloId },
          relations: ['cuentaContable'],
        });

        if (!producto?.cuentaContable) {
          throw new Error(`Artículo ${item.articuloId} no tiene cuenta contable configurada`);
        }

        const cuentaId = producto.cuentaContableId;
        ingresosAgrupados.set(
          cuentaId,
          (ingresosAgrupados.get(cuentaId) ?? 0) + item.subtotal,
        );
      }

      for (const [cuentaId, valor] of ingresosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, { where: { id: cuentaId } });
        if (!cuenta) throw new Error(`Cuenta contable ${cuentaId} no encontrada`);

        detalles.push({
          cuentaId,
          debito:      valor,
          credito:     0,
          descripcion: `ANULACIÓN - Ingreso por ${cuenta.nombre}`,
        });
      }

      // ── Débito: reversa de IVA por Pagar ────────────────────────────
      if (factura.iva > 0) {
        const cuentaIva = await this.obtenerCuentaPorCodigo('2408');
        detalles.push({
          cuentaId:    cuentaIva.id,
          debito:      factura.iva,
          credito:     0,
          descripcion: 'ANULACIÓN - IVA generado en venta',
        });
      }

      // ── Crédito: reversa de Descuentos ───────────────────────────────
      if (factura.descuento > 0) {
        const cuentaDescuento = await this.obtenerCuentaPorCodigo('5305');
        detalles.push({
          cuentaId:    cuentaDescuento.id,
          debito:      0,
          credito:     factura.descuento,
          descripcion: 'ANULACIÓN - Descuento otorgado en venta',
        });
      }

      const asiento = await this.crearAsiento(
        {
          tipo:        TipoAsiento.ANULACION_FACTURA_VENTA,
          fecha:       new Date(),
          referencia:  factura.comprobante_completo,
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
      this.logger.error(`Error asiento anulación: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar asiento de anulación');
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
  async generarAsientoCobro(params: {
    facturaVenta:       FacturasVenta;
    monto:              number;
    fecha:              Date;
    cuentaDebitoCodigo: string; // '1105' | '1110'
    userId:             string;
  }): Promise<AsientoContable> {
    const { facturaVenta, monto, fecha, cuentaDebitoCodigo, userId } = params;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuentaDebito  = await this.obtenerCuentaPorCodigo(cuentaDebitoCodigo);
      const cuentaCredito = await this.obtenerCuentaPorCodigo('1305');
      const medioPagoLabel = cuentaDebitoCodigo === '1105' ? 'Caja' : 'Banco';

      const detalles: DetalleAsiento[] = [
        {
          cuentaId:    cuentaDebito.id,
          debito:      monto,
          credito:     0,
          descripcion: `Cobro en ${medioPagoLabel} - Fact: ${facturaVenta.comprobante_completo}`,
        },
        {
          cuentaId:    cuentaCredito.id,
          debito:      0,
          credito:     monto,
          descripcion: `Abono CxC - Fact: ${facturaVenta.comprobante_completo} | Cliente: ${facturaVenta.clientId}`,
        },
      ];

      const asiento = await this.crearAsiento(
        {
          tipo:        TipoAsiento.COBRO,
          fecha,
          referencia:  facturaVenta.comprobante_completo,
          descripcion: `Cobro $${monto.toLocaleString('es-CO')} - Factura ${facturaVenta.comprobante_completo}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Asiento COBRO generado: ${asiento.numero} | $${monto} | Fact: ${facturaVenta.comprobante_completo}`,
      );
      return asiento;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error asiento cobro: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar asiento de cobro');
    } finally {
      await queryRunner.release();
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
  async generarAsientoPagoCompra(params: {
    facturaCompra:       FacturaCompra;
    monto:               number;
    fecha:               Date;
    cuentaCreditoCodigo: string; // '1105' | '1110'
    userId:              string;
  }): Promise<AsientoContable> {
    const { facturaCompra, monto, fecha, cuentaCreditoCodigo, userId } = params;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuentaDebito  = await this.obtenerCuentaPorCodigo('2205');
      const cuentaCredito = await this.obtenerCuentaPorCodigo(cuentaCreditoCodigo);
      const medioPagoLabel = cuentaCreditoCodigo === '1105' ? 'Caja' : 'Banco';

      const detalles: DetalleAsiento[] = [
        {
          cuentaId:    cuentaDebito.id,
          debito:      monto,
          credito:     0,
          descripcion: `Pago CxP - Compra: ${facturaCompra.numero} | Proveedor: ${facturaCompra.proveedorId}`,
        },
        {
          cuentaId:    cuentaCredito.id,
          debito:      0,
          credito:     monto,
          descripcion: `Pago desde ${medioPagoLabel} - Compra: ${facturaCompra.numero}`,
        },
      ];

      const asiento = await this.crearAsiento(
        {
          tipo: TipoAsiento.PAGO_PROVEEDOR,
          fecha,
          referencia:  facturaCompra.numero,
          descripcion: `Pago $${monto.toLocaleString('es-CO')} a proveedor - Compra ${facturaCompra.numero}`,
          detalles,
          userId,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Asiento PAGO_PROVEEDOR generado: ${asiento.numero} | $${monto} | Compra: ${facturaCompra.numero}`,
      );
      return asiento;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error asiento pago proveedor: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar asiento de pago a proveedor');
    } finally {
      await queryRunner.release();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY — mantenido por compatibilidad con facturas-ventas.service.ts
  // @deprecated Usar PagosService.registrarCobro() → generarAsientoCobro()
  // ══════════════════════════════════════════════════════════════════════════
  async generarAsientoPagoFacturaVenta(
    factura: FacturasVenta,
    userId: string,
  ): Promise<AsientoContable> {
    this.logger.warn(
      `[DEPRECATED] generarAsientoPagoFacturaVenta() → ` +
      `Migrar a PagosService.registrarCobro(). Factura: ${factura.comprobante_completo}`,
    );
    return this.generarAsientoCobro({
      facturaVenta:       factura,
      monto:              factura.total,
      fecha:              new Date(),
      cuentaDebitoCodigo: '1110',
      userId,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS PRIVADOS
  // ══════════════════════════════════════════════════════════════════════════

  private async crearAsiento(
    data: {
      tipo:        TipoAsiento;
      fecha:       Date;
      referencia:  string;
      descripcion: string;
      detalles:    DetalleAsiento[];
      userId:      string;
    },
    queryRunner: any,
  ): Promise<AsientoContable> {
    const totalDebito  = data.detalles.reduce((s, d) => s + d.debito,  0);
    const totalCredito = data.detalles.reduce((s, d) => s + d.credito, 0);

    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      throw new Error(
        `Asiento descuadrado [${data.tipo}]. Débito: ${totalDebito}, Crédito: ${totalCredito}`,
      );
    }

    const numero = await this.generarNumeroAsiento(queryRunner);

    const asiento = queryRunner.manager.create(AsientoContable, {
      numero,
      tipo:        data.tipo,
      fecha:       data.fecha,
      referencia:  data.referencia,
      descripcion: data.descripcion,
      totalDebito,
      totalCredito,
      createdById: data.userId,
    });

    const asientoGuardado = await queryRunner.manager.save(AsientoContable, asiento);

    for (const detalle of data.detalles) {
      const detalleAsiento = queryRunner.manager.create(AsientoDetalle, {
        asientoId:   asientoGuardado.id,
        cuentaId:    detalle.cuentaId,
        debito:      detalle.debito,
        credito:     detalle.credito,
        descripcion: detalle.descripcion,
      });
      await queryRunner.manager.save(AsientoDetalle, detalleAsiento);
    }

    return asientoGuardado;
  }

  private async obtenerCuentaPorCodigo(codigo: string): Promise<CuentaContable> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { codigo, isActive: true },
    });
    if (!cuenta) {
      throw new Error(`Cuenta contable '${codigo}' no encontrada o inactiva`);
    }
    return cuenta;
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