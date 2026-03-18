import { Module } from '@nestjs/common';
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { CuentasBancariasController } from './cuentas-bancarias.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentasBancarias } from './entities/cuentas-bancaria.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CuentasBancarias])],
  controllers: [CuentasBancariasController],
  providers: [CuentasBancariasService],
  exports: [CuentasBancariasService],
})
export class CuentasBancariasModule {}
