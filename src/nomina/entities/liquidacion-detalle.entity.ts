import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Liquidacion } from './liquidacion.entity';
import { ConceptoNomina } from './concepto-nomina.entity';
import { TipoConceptoNomina } from '../enums/tipo-concepto.enum';

@Entity('liquidaciones_nomina_detalle')
export class LiquidacionDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Liquidacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'liquidacionId' })
  liquidacion: Liquidacion;

  @Column()
  liquidacionId: string;

  @ManyToOne(() => ConceptoNomina, { nullable: true })
  @JoinColumn({ name: 'conceptoId' })
  concepto: ConceptoNomina;

  @Column({ nullable: true })
  conceptoId: string;

  @Column()
  conceptoNombreSnapshot: string;

  @Column({ type: 'enum', enum: TipoConceptoNomina })
  tipo: TipoConceptoNomina;

  @Column('decimal', { precision: 15, scale: 2 })
  valor: number;

  @Column({ default: false })
  esRecurrente: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
