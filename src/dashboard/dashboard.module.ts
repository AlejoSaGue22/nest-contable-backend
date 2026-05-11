import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { ReportesModule } from 'src/reportes/reportes-general/reportes.module';

import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([FacturasVenta, FacturaCompra, AsientoDetalle, CuentaContable]),
        ReportesModule,
    ],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule { }
