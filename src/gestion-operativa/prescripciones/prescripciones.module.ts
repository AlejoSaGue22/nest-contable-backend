import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prescripcion } from './entities/prescripcion.entity';
import { PrescripcionesService } from './prescripciones.service';
import { PrescripcionesController } from './prescripciones.controller';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { User } from 'src/users/entities/user.entity';
import { ProfesionalResponsable } from './entities/profesional-responsable.entity';
import { TipoExamenPrescripcion } from './entities/tipo-examen-prescripcion.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Prescripcion, Cliente, User, ProfesionalResponsable, TipoExamenPrescripcion, Empresa])],
  controllers: [PrescripcionesController],
  providers: [PrescripcionesService],
  exports: [PrescripcionesService],
})
export class PrescripcionesModule {}
