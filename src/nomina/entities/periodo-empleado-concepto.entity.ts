import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { PeriodoEmpleado } from './periodo-empleado.entity';
import { ConceptoNomina } from './concepto-nomina.entity';
import { TipoValorConcepto } from '../enums/tipo-valor-concepto.enum';

@Entity('periodos_empleados_conceptos')
export class PeriodoEmpleadoConcepto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PeriodoEmpleado, (pe) => pe.conceptosOcasionales, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'periodoEmpleadoId' })
  periodoEmpleado: PeriodoEmpleado;

  @Column()
  periodoEmpleadoId: string;

  @ManyToOne(() => ConceptoNomina, { eager: true })
  @JoinColumn({ name: 'conceptoId' })
  concepto: ConceptoNomina;

  @Column()
  conceptoId: string;

  @Column('decimal', { precision: 15, scale: 2 })
  valor: number;

  @Column({
    type: 'enum',
    enum: TipoValorConcepto,
    default: TipoValorConcepto.FIJO,
  })
  tipoValor: TipoValorConcepto;

  @Column({ type: 'text', nullable: true })
  observacion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
