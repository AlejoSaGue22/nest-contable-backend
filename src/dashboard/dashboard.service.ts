import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { Repository, Between, Not, In, LessThan, MoreThan, Like, LessThanOrEqual } from 'typeorm';
import { ReportesService } from 'src/reportes/reportes-general/reportes.service';
import { InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';

// export interface DashboardSummary {
//     estadoResultados: any;
//     balanceGeneral: any;
//     recentTransactions: {
//         id: number;
//         type: 'compra' | 'venta';
//         numero: string;
//         entidad: string;
//         total: number;
//         fecha: Date;
//         status: string;
//     }[];
// }

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        @InjectRepository(FacturasVenta)
        private readonly facturaVentaRepository: Repository<FacturasVenta>,
        @InjectRepository(FacturaCompra)
        private readonly facturaCompraRepository: Repository<FacturaCompra>,
        @InjectRepository(AsientoDetalle)
        private readonly asientoDetalleRepository: Repository<AsientoDetalle>,
        @InjectRepository(CuentaContable)
        private readonly cuentaRepository: Repository<CuentaContable>,
        private readonly reportesService: ReportesService,
    ) { }

    async getSummary(period: string = 'current_month') {
        try {
            const now = new Date();
            let startDate: Date;
            let endDate: Date;
            let prevStartDate: Date;
            let prevEndDate: Date;

            // Lógica de fechas según el periodo seleccionado
            switch (period) {
                case 'current_month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = now;
                    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;
                case 'last_month':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0);
                    break;
                case 'last_3_months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    endDate = now;
                    // Comparar contra los 3 meses inmediatamente anteriores
                    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                    prevEndDate = new Date(now.getFullYear(), now.getMonth() - 2, 0);
                    break;
                case 'current_year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = now;
                    prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
                    prevEndDate = new Date(now.getFullYear() - 1, 11, 31);
                    break;
                case 'last_year':
                    startDate = new Date(now.getFullYear() - 1, 0, 1);
                    endDate = new Date(now.getFullYear() - 1, 11, 31);
                    prevStartDate = new Date(now.getFullYear() - 2, 0, 1);
                    prevEndDate = new Date(now.getFullYear() - 2, 11, 31);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = now;
                    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
            }

            // 1. Ventas del Mes (o periodo)
            const salesCurrent = await this.reportesService.generarEstadoResultados(startDate, endDate);
            const salesPrev = await this.reportesService.generarEstadoResultados(prevStartDate, prevEndDate);

            const totalVentasPeriodo = salesCurrent.ingresos.total;
            const totalVentasAnt = salesPrev.ingresos.total;
            const crecimientoVentas = totalVentasAnt > 0 ? ((totalVentasPeriodo - totalVentasAnt) / totalVentasAnt) * 100 : 0;

            // 2. Cuentas por Cobrar (CxC) - Filtrar por facturas hasta el fin del periodo
            const cxc = await this.facturaVentaRepository.find({
                where: {
                    fecha: LessThanOrEqual(endDate),
                    saldoPendiente: MoreThan(0),
                    status: In([InvoiceStatus.ISSUED, InvoiceStatus.ACCEPTED, InvoiceStatus.PAID])
                }
            });

            const totalCxC = cxc.reduce((sum, f) => sum + f.saldoPendiente, 0);
            const vencidasCxC = cxc.filter(f => f.fechaVencimiento && new Date(f.fechaVencimiento) < endDate)
                .reduce((sum, f) => sum + f.saldoPendiente, 0);

            const proximaReferencia = new Date(endDate);
            proximaReferencia.setDate(proximaReferencia.getDate() + 7);
            const proximosCxC = cxc.filter(f => f.fechaVencimiento && new Date(f.fechaVencimiento) >= endDate && new Date(f.fechaVencimiento) <= proximaReferencia)
                .reduce((sum, f) => sum + f.saldoPendiente, 0);

            // 3. Cuentas por Pagar (CxP)
            const cxp = await this.facturaCompraRepository.find({
                where: {
                    fecha: LessThanOrEqual(endDate),
                    saldoPendiente: MoreThan(0),
                    estado: GastoEstado.REGISTRADO
                }
            });

            const totalCxP = cxp.reduce((sum, f) => sum + f.saldoPendiente, 0);
            const vencidasCxP = cxp.filter(f => f.fechaVencimiento && new Date(f.fechaVencimiento) < endDate)
                .reduce((sum, f) => sum + f.saldoPendiente, 0);
            const proximosCxP = cxp.filter(f => f.fechaVencimiento && new Date(f.fechaVencimiento) >= endDate && new Date(f.fechaVencimiento) <= proximaReferencia)
                .reduce((sum, f) => sum + f.saldoPendiente, 0);

            // 4. Gastos del Mes (o periodo)
            const totalGastosPeriodo = salesCurrent.gastos.total + salesCurrent.costos.total;
            const totalGastosAnt = salesPrev.gastos.total + salesPrev.costos.total;
            const crecimientoGastos = totalGastosAnt > 0 ? ((totalGastosPeriodo - totalGastosAnt) / totalGastosAnt) * 100 : 0;

            // 5. Caja/Bancos (Al final del periodo seleccionado para reflejar estado histórico si aplica)
            const referenceDate = (period === 'current_month' || period === 'last_3_months' || period === 'current_year') ? now : endDate;
            const accounts = await this.cuentaRepository.find({
                where: { codigo: Like('11%'), isActive: true }
            });

            const cuentasCajaBancos = await Promise.all(accounts.map(async (acc) => {
                const saldo = await this.reportesService.calcularSaldoCuenta(acc.id, new Date('2000-01-01'), referenceDate);
                return {
                    name: acc.nombre,
                    balance: Math.abs(saldo)
                };
            }));

            // Ordenar: primero los que tienen saldo, luego por nombre
            cuentasCajaBancos.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

            const balanceGeneral = await this.reportesService.generarBalanceGeneral(referenceDate);
            const totalDisponible = balanceGeneral.activos.corrientes; 

            // 6. Recent Transactions
            const recentSales = await this.facturaVentaRepository.find({
                take: 5,
                order: { fecha: 'DESC', createdAt: 'DESC' },
                relations: ['client'],
                where: { status: Not(InvoiceStatus.DRAFT) }
            });

            const recentPurchases = await this.facturaCompraRepository.find({
                take: 5,
                order: { fecha: 'DESC', createdAt: 'DESC' },
                relations: ['proveedor'],
                where: { estado: Not(GastoEstado.BORRADOR) }
            });

            const recentTransactions = [
                ...recentSales.map(s => ({
                    id: s.id,
                    type: 'venta',
                    numero: s.comprobante_completo,
                    entidad: s.client?.razonSocial || s.client?.nombre + ' ' + s.client?.apellido,
                    total: s.total,
                    fecha: s.fecha,
                    status: s.status
                })),
                ...recentPurchases.map(p => ({
                    id: p.id,
                    type: 'compra',
                    numero: p.numero,
                    entidad: p.proveedor?.razonSocial || p.proveedor?.nombre + ' ' + p.proveedor?.apellido,
                    total: p.total,
                    fecha: p.fecha,
                    status: p.estado
                }))
            ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 10);

            // 7. History
            const history = await this.getMonthlyHistory(startDate, endDate, period);

            return {
                sales: {
                    totalMonth: totalVentasPeriodo,
                    totalLastMonth: totalVentasAnt,
                    comparison: crecimientoVentas,
                    trend: crecimientoVentas >= 0 ? 'up' : 'down'
                },
                portfolio: {
                    receivable: {
                        total: totalCxC,
                        overdue: vencidasCxC,
                        nextMaturities: proximosCxC
                    },
                    payable: {
                        total: totalCxP,
                        overdue: vencidasCxP,
                        nextMaturities: proximosCxP
                    }
                },
                expenses: {
                    totalMonth: totalGastosPeriodo,
                    totalLastMonth: totalGastosAnt,
                    comparison: crecimientoGastos
                },
                cash: {
                    totalAvailable: totalDisponible,
                    accounts: cuentasCajaBancos
                },
                recentTransactions,
                history
            };
        } catch (error) {
            this.logger.error(`Error fetching dashboard summary: ${error.message}`, error.stack);
            throw error;
        }
    }

    private async getMonthlyHistory(startDate: Date, endDate: Date, period: string) {
        const months: any[] = [];
        const now = new Date();
        
        let count = 6;
        let startRef = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        if (period === 'current_year' || period === 'last_year') {
            count = period === 'current_year' ? endDate.getMonth() + 1 : 12;
            startRef = new Date(endDate.getFullYear(), count - 1, 1);
        } else if (period === 'last_3_months') {
            count = 3;
        }

        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(startRef.getFullYear(), startRef.getMonth() - i, 1);
            months.push({
                name: d.toLocaleString('es-ES', { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth(),
                start: new Date(d.getFullYear(), d.getMonth(), 1),
                end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
            });
        }

        const series = await Promise.all(months.map(async (m) => {
            // No exceder la fecha fin real si es el mes actual
            const effectiveEnd = m.end > endDate ? endDate : m.end;
            const er = await this.reportesService.generarEstadoResultados(m.start, effectiveEnd);
            return {
                month: m.name.charAt(0).toUpperCase() + m.name.slice(1),
                ingresos: er.ingresos.total,
                egresos: er.gastos.total + er.costos.total,
            };
        }));

        return series;
    }
}
