import { Module } from '@nestjs/common';
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { CuentasBancariasController } from './cuentas-bancarias.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentasBancarias } from './entities/cuentas-bancaria.entity';
import { Banco } from 'src/bancos/entities/banco.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { CuentasModule } from 'src/cuentas/cuentas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CuentasBancarias, Banco]),
    AsientosContablesModule,
    CuentasModule,
  ],
  controllers: [CuentasBancariasController],
  providers: [CuentasBancariasService],
  exports: [CuentasBancariasService],
})
export class CuentasBancariasModule {}
