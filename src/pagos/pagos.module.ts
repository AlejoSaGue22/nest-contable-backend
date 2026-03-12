import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { Pago } from './entities/pago.entity';
import { CuentaBancaria } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { PagosSchedulerService } from './pagos-scheduler.service';

@Module({
  imports: [AsientosContablesModule, TypeOrmModule.forFeature([FacturaCompra, FacturasVenta, Pago, CuentaBancaria])],
  controllers: [PagosController],
  providers: [PagosService, PagosSchedulerService],
})
export class PagosModule { }
