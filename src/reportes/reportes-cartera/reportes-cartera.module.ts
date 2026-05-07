import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesCarteraService } from './reportes-cartera.service';
import { ReportesCarteraController } from './reportes-cartera.controller';
import { Pago } from 'src/pagos/entities/pago.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { NotaAjuste } from 'src/notas-ajuste/entities/notas-ajuste.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Pago,
            FacturasVenta,
            FacturaCompra,
            NotaAjuste,
        ]),
    ],
    providers: [ReportesCarteraService],
    controllers: [ReportesCarteraController],
    exports: [ReportesCarteraService],
})
export class ReportesCarteraModule { }
