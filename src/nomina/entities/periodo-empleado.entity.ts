import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Unique,
} from 'typeorm';
import { PeriodoNomina } from './periodo-nomina.entity';
import { Empleado } from './empleado.entity';

@Entity('periodos_empleados')
@Unique(['periodoId', 'empleadoId'])
export class PeriodoEmpleado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PeriodoNomina, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'periodoId' })
  periodo: PeriodoNomina;

  @Column()
  periodoId: string;

  @ManyToOne(() => Empleado)
  @JoinColumn({ name: 'empleadoId' })
  empleado: Empleado;

  @Column()
  empleadoId: string;

  @Column({ default: 30 })
  diasNovedad: number;

  @Column({ type: 'varchar', default: 'INCLUIDO' })
  estado: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
