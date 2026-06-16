import { Module } from '@nestjs/common';
import { AsientosContablesService } from './asientos-contables.service';
import { AsientosContablesController } from './asientos-contables.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsientoContable } from './entities/asientos-contable.entity';
import { AsientoDetalle } from './entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { ParametrizacionContableModule } from 'src/settings/parametrizacion-contable/parametrizacion-contable.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AsientoContable,
      AsientoDetalle,
      CuentaContable,
      Impuesto,
    ]),
    ParametrizacionContableModule
  ],
  controllers: [AsientosContablesController],
  providers: [AsientosContablesService],
  exports: [AsientosContablesService],
})
export class AsientosContablesModule { }
