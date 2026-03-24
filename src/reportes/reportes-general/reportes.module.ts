import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { ItemsFacturaVenta } from 'src/facturas-ventas/entities/items-facturas-venta.entity';
import { Pago } from 'src/pagos/entities/pago.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FacturasVenta, FacturaCompra, AsientoDetalle, CuentaContable, 
                          Articulo, ItemsFacturaVenta, Pago])],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule { }
