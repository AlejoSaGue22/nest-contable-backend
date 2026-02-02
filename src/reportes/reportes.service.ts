import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';
import { CuentaContable, TipoCuenta } from 'src/cuentas/entities/cuenta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { BalanceGeneral, EstadoResultados, FlujoCaja } from './entities/reporte.entity';

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(
    @InjectRepository(AsientoDetalle)
    private asientoDetalleRepository: Repository<AsientoDetalle>,

    @InjectRepository(CuentaContable)
    private cuentaRepository: Repository<CuentaContable>,

    @InjectRepository(FacturasVenta)
    private facturaRepository: Repository<FacturasVenta>,

    @InjectRepository(FacturaCompra)
    private facturaCompraRepository: Repository<FacturaCompra>,
  ) { }


  /**
   * Genera el Estado de Resultados (P&L)
   * Muestra ingresos - costos - gastos = utilidad
   */
  async generarEstadoResultados(fechaInicio: Date, fechaFin: Date): Promise<EstadoResultados> {
    try {
      // 1. Obtener INGRESOS (cuentas tipo INGRESO - clase 4)
      const cuentasIngresos = await this.cuentaRepository.find({
        where: { tipo: TipoCuenta.INGRESO, isActive: true }
      });

      const ingresosDetalle = await Promise.all(
        cuentasIngresos.map(async (cuenta) => {
          const saldo = await this.calcularSaldoCuenta(
            cuenta.id,
            fechaInicio,
            fechaFin
          );
          return {
            cuenta: `${cuenta.codigo} - ${cuenta.nombre}`,
            valor: saldo
          };
        })
      );

      const totalIngresos = ingresosDetalle.reduce((sum, i) => sum + i.valor, 0);

      // 2. Obtener COSTOS (cuentas 6xxx)
      const cuentasCostos = await this.cuentaRepository
        .createQueryBuilder('cuenta')
        .where("cuenta.codigo LIKE '6%'")
        .andWhere('cuenta.isActive = true')
        .getMany();

      const costosDetalle = await Promise.all(
        cuentasCostos.map(async (cuenta) => {
          const saldo = await this.calcularSaldoCuenta(
            cuenta.id,
            fechaInicio,
            fechaFin
          );
          return {
            cuenta: `${cuenta.codigo} - ${cuenta.nombre}`,
            valor: saldo
          };
        })
      );

      const totalCostos = costosDetalle.reduce((sum, c) => sum + c.valor, 0);

      // 3. UTILIDAD BRUTA
      const utilidadBruta = totalIngresos - totalCostos;

      // 4. Obtener GASTOS (cuentas tipo GASTO - clase 5)
      const cuentasGastos = await this.cuentaRepository.find({
        where: { tipo: TipoCuenta.GASTO, isActive: true }
      });

      const gastosDetalle = await Promise.all(
        cuentasGastos.map(async (cuenta) => {
          const saldo = await this.calcularSaldoCuenta(
            cuenta.id,
            fechaInicio,
            fechaFin
          );
          return {
            cuenta: `${cuenta.codigo} - ${cuenta.nombre}`,
            valor: saldo
          };
        })
      );

      const totalGastos = gastosDetalle.reduce((sum, g) => sum + g.valor, 0);

      // 5. UTILIDAD NETA
      const utilidadNeta = utilidadBruta - totalGastos;

      return {
        periodo: {
          inicio: fechaInicio.toISOString().split('T')[0],
          fin: fechaFin.toISOString().split('T')[0]
        },
        ingresos: {
          total: totalIngresos,
          detalle: ingresosDetalle.filter(i => i.valor > 0)
        },
        costos: {
          total: totalCostos,
          detalle: costosDetalle.filter(c => c.valor > 0)
        },
        utilidadBruta,
        gastos: {
          total: totalGastos,
          detalle: gastosDetalle.filter(g => g.valor > 0)
        },
        utilidadNeta
      };

    } catch (error) {
      this.logger.error(`Error generando estado de resultados: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Genera el Flujo de Caja
   * Muestra entradas vs salidas de efectivo
   */
  async generarFlujoCaja(fechaInicio: Date, fechaFin: Date): Promise<FlujoCaja> {
    try {
      // Obtener cuenta de CAJA (1105)
      const cuentaCaja = await this.cuentaRepository.findOne({
        where: { codigo: '1105' }
      });

      if (!cuentaCaja) {
        throw new Error('Cuenta de caja no configurada');
      }

      // Saldo inicial (antes de fechaInicio)
      const saldoInicial = await this.calcularSaldoCuenta(
        cuentaCaja.id,
        new Date('2000-01-01'),
        new Date(fechaInicio.getTime() - 86400000) // Día anterior
      );

      // Obtener movimientos del período
      const movimientos = await this.asientoDetalleRepository
        .createQueryBuilder('detalle')
        .leftJoinAndSelect('detalle.asiento', 'asiento')
        .where('detalle.cuentaId = :cuentaId', { cuentaId: cuentaCaja.id })
        .andWhere('asiento.fecha BETWEEN :inicio AND :fin', {
          inicio: fechaInicio,
          fin: fechaFin
        })
        .orderBy('asiento.fecha', 'ASC')
        .getMany();

      // Clasificar en entradas y salidas
      const entradas = movimientos
        .filter(m => m.debito > 0)
        .map(m => ({
          concepto: m.descripcion || 'Ingreso',
          valor: m.debito,
          fecha: m.asiento.fecha
        }));

      const salidas = movimientos
        .filter(m => m.credito > 0)
        .map(m => ({
          concepto: m.descripcion || 'Egreso',
          valor: m.credito,
          fecha: m.asiento.fecha
        }));

      const totalEntradas = entradas.reduce((sum, e) => sum + e.valor, 0);
      const totalSalidas = salidas.reduce((sum, s) => sum + s.valor, 0);
      const flujoNeto = totalEntradas - totalSalidas;
      const saldoFinal = saldoInicial + flujoNeto;

      return {
        periodo: {
          inicio: fechaInicio.toISOString().split('T')[0],
          fin: fechaFin.toISOString().split('T')[0]
        },
        entradas: {
          total: totalEntradas,
          detalle: entradas
        },
        salidas: {
          total: totalSalidas,
          detalle: salidas
        },
        flujoNeto,
        saldoInicial,
        saldoFinal
      };

    } catch (error) {
      this.logger.error(`Error generando flujo de caja: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Genera el Balance General
   * Muestra Activos = Pasivos + Patrimonio
   */
  async generarBalanceGeneral(fecha: Date): Promise<BalanceGeneral> {
    try {
      // ACTIVOS
      const cuentasActivos = await this.cuentaRepository.find({
        where: { tipo: TipoCuenta.ACTIVO, isActive: true }
      });

      const activosDetalle = await Promise.all(
        cuentasActivos.map(async (cuenta) => {
          const saldo = await this.calcularSaldoCuenta(
            cuenta.id,
            new Date('2000-01-01'),
            fecha
          );
          return {
            cuenta: cuenta.nombre,
            codigo: cuenta.codigo,
            saldo
          };
        })
      );

      const totalActivos = activosDetalle.reduce((sum, a) => sum + a.saldo, 0);
      const activosCorrientes = activosDetalle
        .filter(a => a.codigo.startsWith('11'))
        .reduce((sum, a) => sum + a.saldo, 0);
      const activosNoCorrientes = totalActivos - activosCorrientes;

      // PASIVOS
      const cuentasPasivos = await this.cuentaRepository.find({
        where: { tipo: TipoCuenta.PASIVO, isActive: true }
      });

      const pasivosDetalle = await Promise.all(
        cuentasPasivos.map(async (cuenta) => {
          const saldo = await this.calcularSaldoCuenta(
            cuenta.id,
            new Date('2000-01-01'),
            fecha
          );
          return {
            cuenta: cuenta.nombre,
            codigo: cuenta.codigo,
            saldo
          };
        })
      );

      const totalPasivos = pasivosDetalle.reduce((sum, p) => sum + p.saldo, 0);
      const pasivosCorrientes = pasivosDetalle
        .filter(p => p.codigo.startsWith('21'))
        .reduce((sum, p) => sum + p.saldo, 0);
      const pasivosNoCorrientes = totalPasivos - pasivosCorrientes;

      // PATRIMONIO
      const cuentasPatrimonio = await this.cuentaRepository.find({
        where: { tipo: TipoCuenta.PATRIMONIO, isActive: true }
      });

      const patrimonioDetalle = await Promise.all(
        cuentasPatrimonio.map(async (cuenta) => {
          const saldo = await this.calcularSaldoCuenta(
            cuenta.id,
            new Date('2000-01-01'),
            fecha
          );
          return {
            cuenta: cuenta.nombre,
            codigo: cuenta.codigo,
            saldo
          };
        })
      );

      const totalPatrimonio = patrimonioDetalle.reduce((sum, p) => sum + p.saldo, 0);

      return {
        fecha: fecha.toISOString().split('T')[0],
        activos: {
          total: totalActivos,
          corrientes: activosCorrientes,
          noCorrientes: activosNoCorrientes,
          detalle: activosDetalle.filter(a => a.saldo > 0)
        },
        pasivos: {
          total: totalPasivos,
          corrientes: pasivosCorrientes,
          noCorrientes: pasivosNoCorrientes,
          detalle: pasivosDetalle.filter(p => p.saldo > 0)
        },
        patrimonio: {
          total: totalPatrimonio,
          detalle: patrimonioDetalle.filter(p => p.saldo > 0)
        }
      };

    } catch (error) {
      this.logger.error(`Error generando balance general: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calcula el saldo de una cuenta en un período
   * considerando su naturaleza (débito o crédito)
   */
  private async calcularSaldoCuenta(cuentaId: string, fechaInicio: Date, fechaFin: Date): Promise<number> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { id: cuentaId }
    });

    if (!cuenta) return 0;

    const movimientos = await this.asientoDetalleRepository
      .createQueryBuilder('detalle')
      .leftJoin('detalle.asiento', 'asiento')
      .where('detalle.cuentaId = :cuentaId', { cuentaId })
      .andWhere('asiento.fecha BETWEEN :inicio AND :fin', {
        inicio: fechaInicio,
        fin: fechaFin
      })
      .select('SUM(detalle.debito)', 'totalDebito')
      .addSelect('SUM(detalle.credito)', 'totalCredito')
      .getRawOne();

    const totalDebito = parseFloat(movimientos?.totalDebito || '0');
    const totalCredito = parseFloat(movimientos?.totalCredito || '0');

    // Calcular saldo según naturaleza de la cuenta
    if (cuenta.naturaleza === 'debito') {
      return totalDebito - totalCredito;
    } else {
      return totalCredito - totalDebito;
    }
  }
}
