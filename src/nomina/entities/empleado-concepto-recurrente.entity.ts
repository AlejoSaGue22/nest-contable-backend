import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Empleado } from './empleado.entity';
import { ConceptoNomina } from './concepto-nomina.entity';
import { TipoValorConcepto } from '../enums/tipo-valor-concepto.enum';

@Entity('empleado_conceptos_recurrentes')
export class EmpleadoConceptoRecurrente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empleado, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empleadoId' })
  empleado: Empleado;

  @Column()
  empleadoId: string;

  @ManyToOne(() => ConceptoNomina)
  @JoinColumn({ name: 'conceptoId' })
  concepto: ConceptoNomina;

  @Column()
  conceptoId: string;

  @Column('decimal', { precision: 15, scale: 2 })
  valor: number;

  @Column({ type: 'enum', enum: TipoValorConcepto, default: TipoValorConcepto.FIJO })
  tipoValor: TipoValorConcepto;

  @Column({ type: 'date' })
  fechaInicio: Date;

  @Column({ type: 'date', nullable: true })
  fechaFin: Date;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'text', nullable: true })
  observacion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
