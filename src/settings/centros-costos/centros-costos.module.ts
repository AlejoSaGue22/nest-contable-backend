import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CentrosCostosService } from './centros-costos.service';
import { CentrosCostosController } from './centros-costos.controller';
import { CentroCosto } from '../../../nomina/entities/centro-costo.entity';

@Module({
    imports: [TypeOrmModule.forFeature([CentroCosto])],
    controllers: [CentrosCostosController],
    providers: [CentrosCostosService],
    exports: [CentrosCostosService],
})
export class CentrosCostosModule {}
