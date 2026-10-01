import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivosFijosService } from './activos-fijos.service';
import { ActivosFijosController } from './activos-fijos.controller';
import { ActivoFijo } from './entities/activo-fijo.entity';
import { DepreciacionActivoFijo } from './entities/depreciacion-activo-fijo.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivoFijo, DepreciacionActivoFijo]),
    AsientosContablesModule,
    AuthModule,
  ],
  controllers: [ActivosFijosController],
  providers: [ActivosFijosService],
  exports: [ActivosFijosService],
})
export class ActivosFijosModule {}
