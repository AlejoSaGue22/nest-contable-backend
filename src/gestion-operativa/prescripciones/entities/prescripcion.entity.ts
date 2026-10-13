import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { ProfesionalResponsable } from './profesional-responsable.entity';
import { TipoExamenPrescripcion } from './tipo-examen-prescripcion.entity';
import { User } from 'src/users/entities/user.entity';
import { BaseTenantEntity } from 'src/common/tenant/base-tenant.entity';

export enum PrescripcionEstado {
  ACTIVA = 'ACTIVA',
  ANULADA = 'ANULADA',
}

export enum TipoLentePrescripcion {
  OFTALMICO = 'OFTALMICO',
  CONTACTO = 'CONTACTO',
  OTRO = 'OTRO',
}

@Entity({ name: 'prescripciones_visuales' })
@Index('UQ_prescripciones_visuales_empresa_numero', ['empresaId', 'numero'], { unique: true, where: '"empresaId" IS NOT NULL' })
@Index('UQ_prescripciones_visuales_numero_sin_empresa', ['numero'], { unique: true, where: '"empresaId" IS NULL' })
export class Prescripcion extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 30 })
  numero: string;

  @Column({ type: 'date' })
  fechaExamen: string;

  @ManyToOne(() => Cliente, { nullable: false })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @Column('uuid')
  clienteId: string;

  @ManyToOne(() => ProfesionalResponsable, { nullable: true })
  @JoinColumn({ name: 'profesionalId' })
  profesional: ProfesionalResponsable | null;

  @Column('uuid', { nullable: true })
  profesionalId: string | null;

  @ManyToOne(() => TipoExamenPrescripcion, { nullable: false })
  @JoinColumn({ name: 'tipoExamenId' })
  tipoExamenRel: TipoExamenPrescripcion;

  @Column('uuid')
  tipoExamenId: string;

  /** Código legado conservado para compatibilidad con prescripciones históricas. */
  @Column({ length: 40, default: 'VALORACION_VISUAL' })
  tipoExamen: string;

  @Column({ type: 'varchar', length: 20 })
  tipoLente: TipoLentePrescripcion;

  @Column({ type: 'jsonb', default: {} })
  ojoDerecho: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  ojoIzquierdo: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  lensometria: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  datosContacto: Record<string, unknown>;

  @Column({ type: 'varchar', length: 80, nullable: true })
  usoIndicado: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  material: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  filtroTratamiento: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  tipoLenteDescripcion: string | null;

  @Column({ type: 'date', nullable: true })
  fechaControl: string | null;

  @Column({ type: 'text', nullable: true })
  indicaciones: string | null;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'text', nullable: true })
  recomendaciones: string | null;

  @Column({ type: 'varchar', length: 20, default: PrescripcionEstado.ACTIVA })
  estado: PrescripcionEstado;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User | null;

  @Column('uuid', { nullable: true })
  creadoPorId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
