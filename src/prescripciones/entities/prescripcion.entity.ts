import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { User } from 'src/users/entities/user.entity';

export enum PrescripcionEstado {
  ACTIVA = 'ACTIVA',
  ANULADA = 'ANULADA',
}

export enum TipoLentePrescripcion {
  OFTALMICO = 'OFTALMICO',
  CONTACTO = 'CONTACTO',
  OTRO = 'OTRO',
}

/** Registro clínico de una valoración visual. Las mediciones por ojo son JSONB
 * para conservar una estructura explícita y permitir agregar parámetros sin
 * alterar la tabla principal. */
@Entity({ name: 'prescripciones_visuales' })
export class Prescripcion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 30 })
  numero: string;

  @Column({ type: 'date' })
  fechaExamen: string;

  @ManyToOne(() => Cliente, { nullable: false })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @Column('uuid')
  clienteId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'profesionalId' })
  profesional: User | null;

  @Column('uuid', { nullable: true })
  profesionalId: string | null;

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
