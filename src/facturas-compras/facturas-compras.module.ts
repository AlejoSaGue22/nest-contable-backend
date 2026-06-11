import { Module } from '@nestjs/common';
import { FacturasComprasService } from './facturas-compras.service';
import { FacturasComprasController } from './facturas-compras.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturaCompra } from './entities/factura-compra.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { FacturaCompraDetalle } from './entities/factura-compra-detalle.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';

@Module({
    imports: [TypeOrmModule.forFeature([FacturaCompra, FacturaCompraDetalle, Proveedor, Articulo, Impuesto, CuentasBancarias]), AsientosContablesModule],
    controllers: [FacturasComprasController],
    providers: [FacturasComprasService],
    exports: [FacturasComprasService]
})
export class FacturasComprasModule { }
