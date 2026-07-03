import { Module } from '@nestjs/common';
import { FacturasVentasService } from './facturas-ventas.service';
import { FacturasVentasController } from './facturas-ventas.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturasVenta } from './entities/facturas-venta.entity';
import { ItemsFacturaVenta } from './entities/items-facturas-venta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { ApiDianModule } from 'src/api-dian/api-dian.module';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { PagosModule } from 'src/pagos/pagos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FacturasVenta, ItemsFacturaVenta, Cliente, Articulo, Impuesto, CuentasBancarias]),
    AsientosContablesModule,
    ApiDianModule,
    PagosModule
  ],
  controllers: [FacturasVentasController],
  providers: [FacturasVentasService],
})
export class FacturasVentasModule { }
