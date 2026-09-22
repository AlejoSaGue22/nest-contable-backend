import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FactusService } from './services/factus.service';
import { EmpresaModule } from '../settings/empresa/empresa.module';
import { Municipality } from '../core/municipalities/entities/municipality.entity';
import { UnidadMedida } from '../core/catalogs/entities/unidad-medida.entity';
import { AnticipoAplicacion } from '../pagos/entities/anticipo-aplicacion.entity';
import { NumberingRangesModule } from '../numbering-ranges/numbering-ranges.module';

@Module({
    imports: [
        HttpModule,
        EmpresaModule,
        TypeOrmModule.forFeature([Municipality, UnidadMedida, AnticipoAplicacion]),
        NumberingRangesModule,
    ],
    providers: [FactusService],
    exports: [FactusService],
})
export class ApiDianModule { }
