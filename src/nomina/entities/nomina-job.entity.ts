import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum EstadoNominaJob {
  PENDIENTE = 'PENDIENTE',
  PROCESANDO = 'PROCESANDO',
  COMPLETADO = 'COMPLETADO',
  FALLIDO = 'FALLIDO',
}

@Entity('nomina_jobs')
export class NominaJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  periodoId: string;

  @Column({ type: 'varchar', length: 50, default: 'LIQUIDACION' })
  tipo: string;

  @Column({ type: 'enum', enum: EstadoNominaJob, default: EstadoNominaJob.PENDIENTE })
  estado: EstadoNominaJob;

  @Column({ type: 'jsonb', nullable: true })
  errores: any;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
