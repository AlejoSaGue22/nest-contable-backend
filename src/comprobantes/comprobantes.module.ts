import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';
import { ComprobantesValidatorService } from './comprobantes-validator.service';
import { TipoComprobante } from './entities/tipo-comprobante.entity';
import { ComprobanteContable } from './entities/comprobante-contable.entity';
import { ComprobanteDetalle } from './entities/comprobante-detalle.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TipoComprobante,
      ComprobanteContable,
      ComprobanteDetalle,
      CuentaContable,
    ]),
    AsientosContablesModule,
  ],
  controllers: [ComprobantesController],
  providers: [ComprobantesService, ComprobantesValidatorService],
  exports: [ComprobantesService],
})
export class ComprobantesModule {}
