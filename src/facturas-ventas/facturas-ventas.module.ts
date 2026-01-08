import { Module } from '@nestjs/common';
import { FacturasVentasService } from './facturas-ventas.service';
import { FacturasVentasController } from './facturas-ventas.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturasVenta } from './entities/facturas-venta.entity';
import { ItemsFacturaVenta } from './entities/items-facturas-venta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Producto } from 'src/productos/entities/producto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FacturasVenta, ItemsFacturaVenta, Cliente, Producto])],
  controllers: [FacturasVentasController],
  providers: [FacturasVentasService],
})
export class FacturasVentasModule {}
