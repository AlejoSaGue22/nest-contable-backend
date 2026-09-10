import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NominaController } from './nomina.controller';
import { NominaService } from './nomina.service';
import { NominaDianService } from './services/nomina-dian.service';
import { Empleado } from './entities/empleado.entity';
import { PeriodoNomina } from './entities/periodo-nomina.entity';
import { Liquidacion } from './entities/liquidacion.entity';
import { PagoNomina } from './entities/pago-nomina.entity';
import { PagoNominaDetalle } from './entities/pago-nomina-detalle.entity';
import { ObligacionNomina } from './entities/obligacion-nomina.entity';
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
import { NominaJob } from './entities/nomina-job.entity';
import { NominaJobsService } from './nomina-jobs.service';
import { ComprobanteContable } from 'src/comprobantes/entities/comprobante-contable.entity';
import { ComprobantesService } from 'src/comprobantes/comprobantes.service';
import { TipoComprobante } from 'src/comprobantes/entities/tipo-comprobante.entity';
import { ComprobanteDetalle } from 'src/comprobantes/entities/comprobante-detalle.entity';
import { ComprobantesValidatorService } from 'src/comprobantes/comprobantes-validator.service';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Empleado,
      PeriodoNomina,
      Liquidacion,
      PagoNomina,
      PagoNominaDetalle,
      ObligacionNomina,
      CuentasBancarias,
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
      ComprobanteContable,
      ComprobanteDetalle,
      NominaJob,
      TipoComprobante,
      CuentaContable
    ]),
    AsientosContablesModule,
  ],
  controllers: [NominaController],
  providers: [NominaService, NominaDianService, NominaJobsService, ComprobantesService, ComprobantesValidatorService],
  exports: [NominaService],
})
export class NominaModule { }


