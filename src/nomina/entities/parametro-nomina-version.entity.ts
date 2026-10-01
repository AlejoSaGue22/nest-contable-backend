import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('parametros_nomina_version')
export class ParametroNominaVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'date' })
  fechaInicioVigencia: Date;

  @Column({ type: 'date', nullable: true })
  fechaFinVigencia: Date;

  @Column('decimal', { precision: 15, scale: 2 })
  smmlv: number;

  @Column('decimal', { precision: 15, scale: 2 })
  auxilioTransporte: number;

  @Column('decimal', { precision: 5, scale: 2, default: 4.00 })
  porcentajeSaludEmpleado: number;

  @Column('decimal', { precision: 5, scale: 2, default: 4.00 })
  porcentajePensionEmpleado: number;

  @Column('decimal', { precision: 5, scale: 2, default: 8.50 })
  porcentajeSaludEmpresa: number;

  @Column('decimal', { precision: 5, scale: 2, default: 12.00 })
  porcentajePensionEmpresa: number;

  @Column('decimal', { precision: 5, scale: 2, default: 4.00 })
  porcentajeCcf: number;

  @Column('decimal', { precision: 5, scale: 2, default: 2.00 })
  porcentajeSena: number;

  @Column('decimal', { precision: 5, scale: 2, default: 3.00 })
  porcentajeIcbf: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
