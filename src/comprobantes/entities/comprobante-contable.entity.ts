import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TipoComprobante } from './tipo-comprobante.entity';
import { ComprobanteDetalle } from './comprobante-detalle.entity';
import { User } from 'src/users/entities/user.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';

export enum EstadoComprobante {
  BORRADOR = 'BORRADOR',
  CONTABILIZADO = 'CONTABILIZADO',
  ANULADO = 'ANULADO',
}

@Entity('comprobantes_contables')
export class ComprobanteContable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @ManyToOne(() => TipoComprobante, { eager: true })
  @JoinColumn({ name: 'tipoComprobanteId' })
  tipoComprobante: TipoComprobante;

  @Column()
  tipoComprobanteId: string;

  @Column()
  numero: string;

  @Column({ type: 'date' })
  fechaDocumento: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaContabilizacion?: Date;

  @Column({ type: 'enum', enum: EstadoComprobante, default: EstadoComprobante.BORRADOR })
  estado: EstadoComprobante;

  @Column({ type: 'text', nullable: true })
  observaciones?: string;

  @Column({ nullable: true })
  asientoId?: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalDebito: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalCredito: number;

  // --- Columnas de auditoría ---
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User;

  @Column()
  creadoPorId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'modificadoPorId' })
  modificadoPor?: User;

  @Column({ nullable: true })
  modificadoPorId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'contabilizadoPorId' })
  contabilizadoPor?: User;

  @Column({ nullable: true })
  contabilizadoPorId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'anuladoPorId' })
  anuladoPor?: User;

  @Column({ nullable: true })
  anuladoPorId?: string;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion?: string;

  @Column({ type: 'timestamp', nullable: true })
  fechaAnulacion?: Date;

  @OneToMany(() => ComprobanteDetalle, (detalle) => detalle.comprobante, { cascade: true })
  detalles: ComprobanteDetalle[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
