import { Module } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { CuentasController } from './cuentas.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentaContable } from './entities/cuenta.entity';
import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CuentaContable, AsientoDetalle])],
  controllers: [CuentasController],
  providers: [CuentasService],
  exports: [CuentasService]
})
export class CuentasModule { }
