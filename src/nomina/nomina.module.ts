import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';
import { NominaDianService } from './services/nomina-dian.service';
import { Empleado } from './entities/empleado.entity';
import { PeriodoNomina } from './entities/periodo-nomina.entity';
import { Liquidacion } from './entities/liquidacion.entity';
import { PagoNomina } from './entities/pago-nomina.entity';
import { EntidadSeguridadSocial } from './entities/entidad-seguridad-social.entity';
import { TipoContratoEntity } from './entities/tipo-contrato.entity';
import { Cargo } from './entities/cargo.entity';
import { CentroCosto } from './entities/centro-costo.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Empleado,
            PeriodoNomina,
            Liquidacion,
            PagoNomina,
            EntidadSeguridadSocial,
            TipoContratoEntity,
            Cargo,
            CentroCosto,
        ]),
        AsientosContablesModule,
    ],
    controllers: [NominaController],
    providers: [NominaService, NominaDianService],
    exports: [NominaService],
})
export class NominaModule { }
