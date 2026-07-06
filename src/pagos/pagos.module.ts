import { Module } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { Pago } from './entities/pago.entity';
import { PagoFacturaDetalle } from './entities/pago-factura-detalle.entity';
import { PagoConceptoDetalle } from './entities/pago-concepto-detalle.entity';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { PagosSchedulerService } from './pagos-scheduler.service';
import { CxcService } from 'src/common/services/cxc.service';
import { CxpService } from 'src/common/services/cxp.service';

@Module({
  imports: [
    AsientosContablesModule,
    TypeOrmModule.forFeature([
      FacturaCompra,
      FacturasVenta,
      Pago,
      PagoFacturaDetalle,
      PagoConceptoDetalle,
      CuentasBancarias
    ])
  ],
  controllers: [PagosController],
  providers: [PagosService, PagosSchedulerService, CxcService, CxpService],
  exports: [PagosService],
})
export class PagosModule { }
