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
import { ConceptoNomina } from './entities/concepto-nomina.entity';
import { EmpleadoConceptoRecurrente } from './entities/empleado-concepto-recurrente.entity';
import { PeriodoEmpleado } from './entities/periodo-empleado.entity';
import { PeriodoEmpleadoConcepto } from './entities/periodo-empleado-concepto.entity';
import { ParametroNominaVersion } from './entities/parametro-nomina-version.entity';
import { LiquidacionDetalle } from './entities/liquidacion-detalle.entity';
import { ConfiguracionContableNomina } from './entities/configuracion-contable-nomina.entity';
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
      ConceptoNomina,
      EmpleadoConceptoRecurrente,
      PeriodoEmpleado,
      PeriodoEmpleadoConcepto,
      ParametroNominaVersion,
      LiquidacionDetalle,
      ConfiguracionContableNomina,
    ]),
    AsientosContablesModule,
  ],
  controllers: [NominaController],
  providers: [NominaService, NominaDianService],
  exports: [NominaService],
})
export class NominaModule {}
