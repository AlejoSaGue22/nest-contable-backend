import { Module } from '@nestjs/common';
import { CuentasService } from './cuentas.service';
import { CuentasController } from './cuentas.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentaContable } from './entities/cuenta.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CuentaContable])],
  controllers: [CuentasController],
  providers: [CuentasService],
  exports: [CuentasService]
})
export class CuentasModule { }
