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

@Module({
  imports: [
    TypeOrmModule.forFeature([NotaAjuste, ItemNotaAjuste, FacturasVenta, Impuesto]), 
    ApiDianModule,
    AsientosContablesModule
  ],
  controllers: [NotasAjusteController],
  providers: [NotasAjusteService],
})
export class NotasAjusteModule { }
