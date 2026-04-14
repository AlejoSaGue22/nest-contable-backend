import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { Repository, Between, Not } from 'typeorm';
import { ReportesService } from 'src/reportes/reportes-general/reportes.service';
import { InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';

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
        private readonly reportesService: ReportesService,
    ) { }

    async getSummary() {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

            // 1. Totals (Current Month)
            const estadoResultados = await this.reportesService.generarEstadoResultados(firstDayOfMonth, lastDayOfMonth);

            // Saldo de Caja (actual)
            const balanceGeneral = await this.reportesService.generarBalanceGeneral(now);

            // 2. Recent Transactions (last 5 sales + last 5 purchases)
            const recentSales = await this.facturaVentaRepository.find({
                take: 5,
                order: { fecha: 'DESC', createdAt: 'DESC' },
                relations: ['client'],
                where: {
                    status: Not(InvoiceStatus.DRAFT)
                }
            });

            const recentPurchases = await this.facturaCompraRepository.find({
                take: 5,
                order: { fecha: 'DESC', createdAt: 'DESC' },
                relations: ['proveedor'],
                where: {
                    estado: Not(GastoEstado.BORRADOR)
                }
            });

            const recentTransactions = [
                ...recentSales.map(s => ({
                    id: s.id,
                    type: 'venta',
                    numero: s.comprobante_completo,
                    entidad: s.client.razonSocial || s.client?.nombre + ' ' + s.client?.apellido,
                    total: s.total,
                    fecha: s.fecha,
                    status: s.status
                })),
                ...recentPurchases.map(p => ({
                    id: p.id,
                    type: 'compra',
                    numero: p.numero,
                    entidad: p.proveedor.razonSocial || p.proveedor?.nombre + ' ' + p.proveedor?.apellido,
                    total: p.total,
                    fecha: p.fecha,
                    status: p.estado
                }))
            ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 10);

            // 3. Totales de Compras (del módulo FacturaCompra para el mes actual)
            const comprasMes = await this.facturaCompraRepository.find({
                where: {
                    fecha: Between(firstDayOfMonth, lastDayOfMonth),
                    estado: GastoEstado.REGISTRADO
                }
            });
            const totalCompras = comprasMes.reduce((sum, c) => sum + c.total, 0);

            // 4. Monthly History (Last 6 months)
            const history = await this.getMonthlyHistory();

            return {
                totals: {
                    ingresos: estadoResultados.ingresos.total,
                    egresos: estadoResultados.gastos.total + estadoResultados.costos.total,
                    compras: totalCompras,
                    utilidad: estadoResultados.utilidadNeta,
                    saldoCaja: balanceGeneral.activos.corrientes,
                },
                recentTransactions,
                history
            };
        } catch (error) {
            this.logger.error(`Error fetching dashboard summary: ${error.message}`, error.stack);
            throw error;
        }
    }

    private async getMonthlyHistory() {
        const months: any[] = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                name: d.toLocaleString('es-ES', { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth(),
                start: new Date(d.getFullYear(), d.getMonth(), 1),
                end: new Date(d.getFullYear(), d.getMonth() + 1, 0)
            });
        }

        const series = await Promise.all(months.map(async (m) => {
            const er = await this.reportesService.generarEstadoResultados(m.start, m.end);
            return {
                month: m.name,
                ingresos: er.ingresos.total,
                egresos: er.gastos.total + er.costos.total,
            };
        }));

        return series;
    }
}
