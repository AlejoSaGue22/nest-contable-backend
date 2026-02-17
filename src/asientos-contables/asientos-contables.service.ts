import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateAsientosContableDto } from './dto/create-asientos-contable.dto';
import { UpdateAsientosContableDto } from './dto/update-asientos-contable.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { AsientoContable, TipoAsiento } from './entities/asientos-contable.entity';
import { DataSource, Repository } from 'typeorm';
import { AsientoDetalle } from './entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
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
  ) { }

  /**
   * Genera asiento contable automático para factura de venta
   * 
   * Lógica:
   * DEBITO:  Caja / Cuentas por Cobrar (1105 o 1305)
   * CREDITO: Ingresos (cuenta del artículo)
   * CREDITO: IVA por Pagar (2408)
   */

  async generarAsientoFacturaVenta(factura: FacturasVenta, userId: string): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = [];

      // 1. Cuenta de CAJA o CXC (DEBITO)
      const cuentaCaja = await this.obtenerCuentaPorCodigo('1105'); // Caja
      const totalFactura = factura.total;


      detalles.push({
        cuentaId: cuentaCaja.id,
        debito: totalFactura,
        credito: 0,
        descripcion: `Factura de venta ${factura.comprobante_completo} - Cliente: ${factura.clientId}`
      });

      // 2. Procesar items para INGRESOS (CREDITO)
      const ingresosAgrupados = new Map<string, number>();

      for (const item of factura.items) {
        const producto = await queryRunner.manager.findOne(Articulo, {
          where: { id: item.articuloId },
          relations: ['cuentaContable', 'cuentaIva']
        });

        if (!producto?.cuentaContable) {
          throw new Error(`Artículo ${item.articuloId} no tiene cuenta contable configurada`);
        }

        const cuentaId = producto.cuentaContableId;
        const subtotal = item.subtotal;

        if (ingresosAgrupados.has(cuentaId)) {
          ingresosAgrupados.set(cuentaId, ingresosAgrupados.get(cuentaId)! + subtotal);
        } else {
          ingresosAgrupados.set(cuentaId, subtotal);
        }
      }

      // Agregar detalles de ingresos
      for (const [cuentaId, valor] of ingresosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId }
        });

        if (!cuenta) {
          throw new Error(`Cuenta contable ${cuentaId} no encontrada`);
        }

        console.log('cuenta de ingreso: ', cuenta);

        detalles.push({
          cuentaId,
          debito: 0,
          credito: valor,
          descripcion: `Ingreso por ${cuenta.nombre}`
        });
      }

      // 3. IVA por Pagar (CREDITO)
      if (factura.iva > 0) {
        const cuentaIva = await this.obtenerCuentaPorCodigo('2408'); // IVA por pagar

        detalles.push({
          cuentaId: cuentaIva.id,
          debito: 0,
          credito: factura.iva,
          descripcion: 'IVA generado en venta'
        });
      }

      // 4. Descuentos (si aplica)
      if (factura.descuento > 0) {
        const cuentaDescuento = await this.obtenerCuentaPorCodigo('5305'); // Descuentos en ventas

        detalles.push({
          cuentaId: cuentaDescuento.id,
          debito: factura.descuento,
          credito: 0,
          descripcion: 'Descuento otorgado en venta'
        });
      }

      // Crear asiento
      const asiento = await this.crearAsiento({
        tipo: TipoAsiento.FACTURA_VENTA,
        fecha: factura.fecha,
        referencia: factura.comprobante_completo,
        descripcion: `Asiento automático - Factura ${factura.comprobante_completo}`,
        detalles,
        userId
      }, queryRunner);

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento generado para factura ${factura.comprobante_completo}: ${asiento.numero}`);

      return asiento;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error generando asiento para factura: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar asiento contable');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Genera asiento contable automático para gasto
   * 
   * Lógica:
   * DEBITO:  Cuenta de Gasto (cuenta del artículo)
   * DEBITO:  IVA Descontable (2408 o 1355)
   * CREDITO: Caja / Cuentas por Pagar (1105 o 2205)
   */
  async generarAsientoGasto(
    gasto: FacturaCompra,
    userId: string
  ): Promise<AsientoContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const detalles: DetalleAsiento[] = [];

      // 1. Procesar items de gasto (DEBITO)
      const gastosAgrupados = new Map<string, number>();

      for (const item of gasto.items) {
        const articulo = await queryRunner.manager.findOne(Articulo, {
          where: { id: item.articuloId },
          relations: ['cuentaContable']

        });

        if (!articulo?.cuentaContable) {
          throw new Error(`Artículo ${item.articuloId} no tiene cuenta contable configurada`);
        }

        const cuentaId = articulo.cuentaContableId;
        const valor = item.valorSubtotal;


        if (gastosAgrupados.has(cuentaId)) {
          gastosAgrupados.set(cuentaId, gastosAgrupados.get(cuentaId)! + valor);
        } else {
          gastosAgrupados.set(cuentaId, valor);
        }
      }

      for (const [cuentaId, valor] of gastosAgrupados) {
        const cuenta = await queryRunner.manager.findOne(CuentaContable, {
          where: { id: cuentaId }
        });

        detalles.push({
          cuentaId,
          debito: valor,
          credito: 0,
          descripcion: `Gasto - ${cuenta?.nombre}`
        });
      }

      // 2. IVA Descontable (DEBITO)
      if (gasto.iva > 0) {
        const cuentaIvaCredito = await this.obtenerCuentaPorCodigo('1355'); // IVA descontable

        detalles.push({
          cuentaId: cuentaIvaCredito.id,
          debito: gasto.iva,
          credito: 0,
          descripcion: 'IVA descontable'
        });
      }

      // 3. Caja o Cuentas por Pagar (CREDITO)
      const cuentaPago = await this.obtenerCuentaPorCodigo('1105'); // Caja
      const totalGasto = gasto.total;

      detalles.push({
        cuentaId: cuentaPago.id,
        debito: 0,
        credito: totalGasto,
        descripcion: `Pago de gasto - Proveedor: ${gasto.proveedorId}`
      });

      // Crear asiento
      const asiento = await this.crearAsiento({
        tipo: TipoAsiento.GASTO,
        fecha: gasto.fecha,
        referencia: gasto.numero,
        descripcion: `Asiento automático - Gasto ${gasto.numero}`,
        detalles,
        userId
      }, queryRunner);

      await queryRunner.commitTransaction();
      this.logger.log(`Asiento generado para gasto ${gasto.numero}: ${asiento.numero}`);

      return asiento;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error generando asiento para gasto: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al generar asiento contable');
    } finally {
      await queryRunner.release();
    }
  }


  /**
   * Crea un asiento contable con sus detalles
   */
  private async crearAsiento(
    data: {
      tipo: TipoAsiento;
      fecha: Date;
      referencia: string;
      descripcion: string;
      detalles: DetalleAsiento[];
      userId: string;
    },
    queryRunner: any
  ): Promise<AsientoContable> {
    // Validar que esté cuadrado
    const totalDebito = data.detalles.reduce((sum, d) => sum + d.debito, 0);
    const totalCredito = data.detalles.reduce((sum, d) => sum + d.credito, 0);

    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      throw new Error(`Asiento descuadrado. Débito: ${totalDebito}, Crédito: ${totalCredito}`);
    }

    // Generar número de asiento
    const numero = await this.generarNumeroAsiento(queryRunner);

    // Crear asiento
    const asiento = queryRunner.manager.create(AsientoContable, {
      numero,
      tipo: data.tipo,
      fecha: data.fecha,
      referencia: data.referencia,
      descripcion: data.descripcion,
      totalDebito,
      totalCredito,
      createdById: data.userId
    });

    const asientoGuardado = await queryRunner.manager.save(AsientoContable, asiento);

    // Crear detalles
    for (const detalle of data.detalles) {
      const detalleAsiento = queryRunner.manager.create(AsientoDetalle, {
        asientoId: asientoGuardado.id,
        cuentaId: detalle.cuentaId,
        debito: detalle.debito,
        credito: detalle.credito,
        descripcion: detalle.descripcion
      });

      await queryRunner.manager.save(AsientoDetalle, detalleAsiento);
    }

    return asientoGuardado;
  }

  private async obtenerCuentaPorCodigo(codigo: string): Promise<CuentaContable> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { codigo, isActive: true }
    });

    if (!cuenta) {
      throw new Error(`Cuenta contable ${codigo} no encontrada o inactiva`);
    }

    return cuenta;
  }

  private async generarNumeroAsiento(queryRunner: any): Promise<string> {
    const ultimoAsiento = await queryRunner.manager.findOne(AsientoContable, {
      where: {},
      order: { createdAt: 'DESC' }
    });

    const ultimoNumero = ultimoAsiento ? parseInt(ultimoAsiento.numero) : 0;
    return (ultimoNumero + 1).toString().padStart(8, '0');
  }
}
