import { Module } from '@nestjs/common';
import { AsientosContablesService } from './asientos-contables.service';
import { AsientosContablesController } from './asientos-contables.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsientoContable } from './entities/asientos-contable.entity';
import { AsientoDetalle } from './entities/asientos-detalles.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AsientoContable, AsientoDetalle, CuentaContable, Impuesto])],
  controllers: [AsientosContablesController],
  providers: [AsientosContablesService],
  exports: [AsientosContablesService],
})
export class AsientosContablesModule { }
