import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Unique,
} from 'typeorm';
import { PeriodoNomina } from './periodo-nomina.entity';
import { Empleado } from './empleado.entity';
import { PeriodoEmpleadoConcepto } from './periodo-empleado-concepto.entity';

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

  @OneToMany(() => PeriodoEmpleadoConcepto, (pec) => pec.periodoEmpleado, {
    cascade: true,
  })
  conceptosOcasionales: PeriodoEmpleadoConcepto[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
