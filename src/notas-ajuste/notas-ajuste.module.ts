import { Module } from '@nestjs/common';
import { NotasAjusteService } from './notas-ajuste.service';
import { NotasAjusteController } from './notas-ajuste.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotaAjuste } from './entities/notas-ajuste.entity';
import { ItemNotaAjuste } from './entities/items-notas-ajuste.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { ApiDianModule } from 'src/api-dian/api-dian.module';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { InventarioModule } from 'src/inventario/inventario.module';
import { DisponibilidadNotaService } from './disponibilidad/disponibilidad-nota.service';
import { PaymentDetailsResolver } from './factus/payment-details.resolver';
import { CreditNoteCalculator } from './credito/credit-note-calculator.service';
import { CarteraNotaService } from './cartera/cartera-nota.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotaAjuste, ItemNotaAjuste, FacturasVenta, Impuesto]),
    ApiDianModule,
    AsientosContablesModule,
    InventarioModule
  ],
  controllers: [NotasAjusteController],
  providers: [NotasAjusteService, DisponibilidadNotaService, PaymentDetailsResolver, CreditNoteCalculator, CarteraNotaService],
  exports: [DisponibilidadNotaService, PaymentDetailsResolver, CreditNoteCalculator, CarteraNotaService],
})
export class NotasAjusteModule { }
