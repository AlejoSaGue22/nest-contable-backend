import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParametrizacionContable } from './entities/parametrizacion-contable.entity';
import { ParametrizacionContableService } from './parametrizacion-contable.service';
import { ParametrizacionContableController } from './parametrizacion-contable.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParametrizacionContable])],
  controllers: [ParametrizacionContableController],
  providers: [ParametrizacionContableService],
  exports: [ParametrizacionContableService],
})
export class ParametrizacionContableModule {}
