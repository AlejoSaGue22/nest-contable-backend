import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';
import { CuentaContable, TipoCuenta } from 'src/cuentas/entities/cuenta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { BalanceGeneral, EstadoResultados, FlujoCaja } from './entities/reporte.entity';
import { Between, In } from 'typeorm';
import { DianStatus, InvoiceStatus, TipoFactura } from 'src/facturas-ventas/enums/factura-venta.enum';
import { DashboardAvanzadoKPIs, ReporteConciliacionDIAN, ReporteConciliacionRecaudos, ReporteFacturacionAvanzada, ReporteImpuestos } from './dto/reportes-avanzados.dto';
import { ItemsFacturaVenta } from 'src/facturas-ventas/entities/items-facturas-venta.entity';
import { Pago } from 'src/pagos/entities/pago.entity';
import { TipoPago } from 'src/pagos/enums/pago.enum';

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

    @InjectRepository(ItemsFacturaVenta)
    private itemsFacturaRepository: Repository<ItemsFacturaVenta>,

    @InjectRepository(Pago)
    private pagoRepository: Repository<Pago>,
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

      // 2. Obtener COSTOS (cuentas tipo COSTO - clase 6)
      const cuentasCostos = await this.cuentaRepository.find({
        where: { tipo: TipoCuenta.COSTO, isActive: true }
      });

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
      // Obtener cuenta de CAJA (1105) o BANCOS (1110)
      const cuentaCaja = await this.cuentaRepository.findOne({
        where: [{ codigo: '1105' }, { codigo: '1110' }]
      });

      if (!cuentaCaja) {
        throw new Error('Cuenta de caja o bancos no configurada');
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

    // Asegurar que la fecha fin incluya todo el día
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const movimientos = await this.asientoDetalleRepository
      .createQueryBuilder('detalle')
      .leftJoin('detalle.asiento', 'asiento')
      .where('detalle.cuentaId = :cuentaId', { cuentaId })
      .andWhere('asiento.fecha BETWEEN :inicio AND :fin', {
        inicio: fechaInicio,
        fin: fin
      })
      .select('SUM(detalle.debito)', 'totalDebito')
      .addSelect('SUM(detalle.credito)', 'totalCredito')
      .getRawOne();

    const totalDebito = parseFloat(movimientos?.totalDebito || '0');
    const totalCredito = parseFloat(movimientos?.totalCredito || '0');

    // Calcular saldo según naturaleza de la cuenta
    if (cuenta.naturaleza === 'DEBITO') {
      return totalDebito - totalCredito;
    } else {
      return totalCredito - totalDebito;
    }
  }

  // =========================================================================
  // REPORTES AVANZADOS
  // =========================================================================

  /**
   * Reporte Detallado de Facturación (Electronica vs Standard)
   */
  async generarReporteFacturacionAvanzada(fechaInicio: Date, fechaFin: Date): Promise<ReporteFacturacionAvanzada> {
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const facturas = await this.facturaRepository.find({
      where: {
        createdAt: Between(fechaInicio, fin)
      },
      relations: ['client'],
      order: { createdAt: 'ASC' }
    });

    const electronicas = facturas.filter(f => f.tipoFactura === TipoFactura.ELECTRONICA);
    const standard = facturas.filter(f => f.tipoFactura === TipoFactura.STANDARD);

    // Top Clientes
    const clientesMap = new Map<string, { nombre: string; cant: number; monto: number }>();
    facturas.forEach(f => {
      const key = f.clientId;
      const data = clientesMap.get(key) || { nombre: f.client?.razonSocial || (f.client.nombre + " " + f.client.apellido), cant: 0, monto: 0 };
      data.cant++;
      data.monto += Number(f.total);
      clientesMap.set(key, data);
    });

    const topClientes = Array.from(clientesMap.entries())
      .map(([id, data]) => ({
        clienteId: id,
        clienteNombre: data.nombre,
        cantidadFacturas: data.cant,
        montoTotal: data.monto
      }))
      .sort((a, b) => b.montoTotal - a.montoTotal)
      .slice(0, 10);

    // Ventas por día
    const ventasDiaMap = new Map<string, { el: number; st: number; total: number }>();
    facturas.forEach(f => {
      const dia = f.createdAt.toISOString().split('T')[0];
      const data = ventasDiaMap.get(dia) || { el: 0, st: 0, total: 0 };
      if (f.tipoFactura === TipoFactura.ELECTRONICA) data.el++;
      else data.st++;
      data.total += Number(f.total);
      ventasDiaMap.set(dia, data);
    });

    const ventasPorDia = Array.from(ventasDiaMap.entries())
      .map(([fecha, data]) => ({
        fecha,
        cantidadElectronicas: data.el,
        cantidadStandard: data.st,
        montoTotal: data.total
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return {
      periodo: { fechaInicio, fechaFin },
      resumen: {
        totalFacturas: facturas.length,
        totalElectronicas: electronicas.length,
        totalStandard: standard.length,
        montoTotal: facturas.reduce((s, f) => s + Number(f.total), 0),
        montoElectronicas: electronicas.reduce((s, f) => s + Number(f.total), 0),
        montoStandard: standard.reduce((s, f) => s + Number(f.total), 0),
        ivaTotal: facturas.reduce((s, f) => s + Number(f.iva), 0)
      },
      electronicas: {
        emitidas: electronicas.length,
        aceptadas: electronicas.filter(f => f.dianStatus === DianStatus.ACCEPTED).length,
        rechazadas: electronicas.filter(f => f.dianStatus === DianStatus.REJECTED).length,
        pendientes: electronicas.filter(f => [DianStatus.PENDING, DianStatus.SENT, DianStatus.PROCESSING].includes(f.dianStatus)).length,
        tasaAceptacion: electronicas.length > 0 ? (electronicas.filter(f => f.dianStatus === DianStatus.ACCEPTED).length / electronicas.length) * 100 : 0,
        montoPromedio: electronicas.length > 0 ? electronicas.reduce((s, f) => s + Number(f.total), 0) / electronicas.length : 0
      },
      standard: {
        emitidas: standard.length,
        anuladas: standard.filter(f => f.status === InvoiceStatus.CANCELLED).length,
        montoPromedio: standard.length > 0 ? standard.reduce((s, f) => s + Number(f.total), 0) / standard.length : 0,
        totalPagado: standard.reduce((s, f) => s + Number(f.totalPagado), 0),
        saldoPendiente: standard.reduce((s, f) => s + Number(f.saldoPendiente), 0)
      },
      topClientes,
      ventasPorDia
    };
  }

  /**
   * Conciliación DIAN (Ventas vs Contabilidad)
   */
  async generarReporteConciliacionDIAN(fechaInicio: Date, fechaFin: Date): Promise<ReporteConciliacionDIAN> {
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    // Facturas Electrónicas Aceptadas
    const electronicasAceptadas = await this.facturaRepository.find({
      where: {
        tipoFactura: TipoFactura.ELECTRONICA,
        dianStatus: DianStatus.ACCEPTED,
        createdAt: Between(fechaInicio, fin)
      }
    });

    const montoAcceptedDIAN = electronicasAceptadas.reduce((s, f) => s + Number(f.total), 0);

    // Saldo en Cuentas de Ingreso (4135, 4155)
    const codigosIngreso = ['4135', '4155'];
    const cuentasIngreso = await this.cuentaRepository.find({
      where: { codigo: In(codigosIngreso) }
    });

    const detallePorCuenta = await Promise.all(
      cuentasIngreso.map(async (c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        saldo: await this.calcularSaldoCuenta(c.id, fechaInicio, fin)
      }))
    );

    const saldoCuentasIngreso = detallePorCuenta.reduce((s, c) => s + c.saldo, 0);

    // Detección de Standard que expliquen la diferencia
    const standardTotal = await this.facturaRepository.find({
      where: {
        tipoFactura: TipoFactura.STANDARD,
        createdAt: Between(fechaInicio, fin)
      }
    }).then(list => list.reduce((s, f) => s + Number(f.subtotal), 0)); // Comparar subtotal usualmente es mejor si cuentas de ingreso no incluyen IVA

    const diferencia = saldoCuentasIngreso - montoAcceptedDIAN;
    const cuadra = Math.abs(diferencia - standardTotal) < 100; // Tolerancia por redondeo o precisión decimal

    return {
      periodo: { fechaInicio, fechaFin },
      facturasElectronicas: {
        cantidad: electronicasAceptadas.length,
        montoDebito: electronicasAceptadas.reduce((s, f) => s + Number(f.subtotal), 0),
        montoAcceptedDIAN
      },
      contabilidad: {
        saldoCuentasIngreso,
        detallePorCuenta
      },
      diferencia,
      cuadra,
      explicacion: cuadra ? 'La diferencia coincide con las facturas estándar registradas.' : 'Existe una diferencia no explicada por facturas estándar.'
    };
  }

  /**
   * Conciliación de Recaudos (Sistema vs Contabilidad Bancaria)
   */
  async generarReporteConciliacionRecaudos(fechaInicio: Date, fechaFin: Date): Promise<ReporteConciliacionRecaudos> {
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    // Total Pagos registrados en plataforma (Recaudos/Cobros)
    const pagos = await this.pagoRepository.find({
      where: {
        tipo: TipoPago.COBRO,
        fecha: Between(fechaInicio, fin)
      }
    });

    const totalPagosRegistrados = pagos.reduce((s, p) => s + Number(p.monto), 0);

    // Total Movimientos en Cuenta 1110 (Bancos) - Solo Débitos (Entradas)
    const cuentaBancos = await this.cuentaRepository.findOne({ where: { codigo: '1110' } });
    let totalMovimientosBancos = 0;
    if (cuentaBancos) {
      const result = await this.asientoDetalleRepository
        .createQueryBuilder('d')
        .leftJoin('d.asiento', 'a')
        .where('d.cuentaId = :id', { id: cuentaBancos.id })
        .andWhere('a.fecha BETWEEN :ini AND :fin', { ini: fechaInicio, fin })
        .select('SUM(d.debito)', 'total')
        .getRawOne();
      totalMovimientosBancos = parseFloat(result.total || '0');
    }

    // Detalle por medio
    const detallePorMedioMap = new Map<string, number>();
    pagos.forEach(p => {
      detallePorMedioMap.set(p.medioPago, (detallePorMedioMap.get(p.medioPago) || 0) + Number(p.monto));
    });

    const detallePorMedio = Array.from(detallePorMedioMap.entries()).map(([medio, monto]) => ({
      medio: medio as any,
      monto
    }));

    return {
      periodo: { fechaInicio, fechaFin },
      totalPagosRegistrados,
      totalMovimientosBancos,
      diferencia: totalPagosRegistrados - totalMovimientosBancos,
      cuadra: Math.abs(totalPagosRegistrados - totalMovimientosBancos) < 1,
      detallePorMedio
    };
  }

  /**
   * Reporte de Impuestos IVA Detallado
   */
  async generarReporteImpuestosAvanzado(fechaInicio: Date, fechaFin: Date): Promise<ReporteImpuestos> {
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const facturas = await this.facturaRepository.find({
      where: {
        createdAt: Between(fechaInicio, fin),
        status: In([InvoiceStatus.ACCEPTED, InvoiceStatus.ISSUED, InvoiceStatus.PAID])
      },
      relations: ['items']
    });

    const tarifaMap = new Map<number, { base: number; iva: number; cant: number }>();
    let baseEl = 0, ivaEl = 0;
    let baseSt = 0, ivaSt = 0;

    facturas.forEach(f => {
      f.items?.forEach(item => {
        const rate = Number(item.iva);
        const base = Number(item.subtotal);
        const iva = Number(item.valor_iva);

        const data = tarifaMap.get(rate) || { base: 0, iva: 0, cant: 0 };
        data.base += base;
        data.iva += iva;
        data.cant++;
        tarifaMap.set(rate, data);

        if (f.tipoFactura === TipoFactura.ELECTRONICA) {
          baseEl += base;
          ivaEl += iva;
        } else {
          baseSt += base;
          ivaSt += iva;
        }
      });
    });

    const desglosePorTarifa = Array.from(tarifaMap.entries()).map(([rate, d]) => ({
      tarifa: rate,
      base: d.base,
      iva: d.iva,
      cantidadItems: d.cant
    })).sort((a,b) => a.tarifa - b.tarifa);

    return {
      periodo: { fechaInicio, fechaFin },
      totalIVAGenerado: facturas.reduce((s, f) => s + Number(f.iva), 0),
      desglosePorTarifa,
      porTipoFactura: {
        electronicas: { base: baseEl, iva: ivaEl },
        standard: { base: baseSt, iva: ivaSt }
      }
    };
  }

  /**
   * Dashboard Avanzado con Comparativa
   */
  async generarDashboardAvanzado(): Promise<DashboardAvanzadoKPIs> {
    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);

    // Datos Hoy
    const facturasHoy = await this.facturaRepository.find({
      where: { createdAt: Between(hoyInicio, ahora) }
    });
    const montoHoy = facturasHoy.reduce((s,f) => s + Number(f.total), 0);
    const rechazoHoy = facturasHoy.filter(f => f.dianStatus === DianStatus.REJECTED).length;

    // Datos Semana (últimos 7 días)
    const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace14Dias = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const facturasSemana = await this.facturaRepository.find({ where: { createdAt: Between(hace7Dias, ahora) } });
    const facturasSemanaAnt = await this.facturaRepository.find({ where: { createdAt: Between(hace14Dias, hace7Dias) } });
    
    const montoSemana = facturasSemana.reduce((s,f) => s + Number(f.total), 0);
    const montoSemanaAnt = facturasSemanaAnt.reduce((s,f) => s + Number(f.total), 0);
    const crecimientoSem = montoSemanaAnt > 0 ? ((montoSemana - montoSemanaAnt) / montoSemanaAnt) * 100 : 0;

    // Datos Mes
    const iniMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const iniMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const finMesAnt = new Date(ahora.getFullYear(), ahora.getMonth(), 0);

    const facturasMes = await this.facturaRepository.find({ where: { createdAt: Between(iniMes, ahora) } });
    const facturasMesAnt = await this.facturaRepository.find({ where: { createdAt: Between(iniMesAnt, finMesAnt) } });

    const montoMes = facturasMes.reduce((s,f) => s + Number(f.total), 0);
    const montoMesAnt = facturasMesAnt.reduce((s,f) => s + Number(f.total), 0);
    const crecimientoMes = montoMesAnt > 0 ? ((montoMes - montoMesAnt) / montoMesAnt) * 100 : 0;

    // Proyeccion
    const diaActual = ahora.getDate();
    const totalDiasMes = finMes.getDate();
    const proyeccion = (montoMes / diaActual) * totalDiasMes;

    // Alertas
    const facturasRechazadas = await this.facturaRepository.count({ where: { dianStatus: DianStatus.REJECTED } });
    const erroresAsiento = await this.facturaRepository.count({ where: { status: InvoiceStatus.ERROR_ASIENTO } });

    return {
      hoy: {
        cantidad: facturasHoy.length,
        total: montoHoy,
        tasaRechazo: facturasHoy.length > 0 ? (rechazoHoy / facturasHoy.length) * 100 : 0
      },
      semana: {
        cantidad: facturasSemana.length,
        total: montoSemana,
        crecimiento: crecimientoSem
      },
      mes: {
        cantidad: facturasMes.length,
        total: montoMes,
        proyeccionFinMes: proyeccion,
        crecimiento: crecimientoMes
      },
      alertas: {
        facturasRechazadas,
        saldosVencidos: 0, // TODO: Implementar lógica de vencimiento
        erroresAsiento
      }
    };
  }
}
