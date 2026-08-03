import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { TipoDocumentoIdentidad } from '../enums/tipo-documento.enum';
import { TipoContrato } from '../enums/tipo-contrato.enum';
import { AreaEmpleado } from '../enums/area-empleado.enum';
import { TipoContratoEntity } from './tipo-contrato.entity';
import { EntidadSeguridadSocial } from './entidad-seguridad-social.entity';
import { Cargo } from './cargo.entity';
import { CentroCosto } from './centro-costo.entity';
import { Banco } from 'src/bancos/entities/banco.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';

@Entity('empleados')
export class Empleado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @Column({ type: 'enum', enum: TipoDocumentoIdentidad })
  tipoDocumento: TipoDocumentoIdentidad;

  @Column({ unique: true })
  numeroDocumento: string;

  @Column()
  primerNombre: string;

  @Column({ nullable: true })
  segundoNombre: string;

  @Column()
  primerApellido: string;

  @Column({ nullable: true })
  segundoApellido: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  direccion: string;

  @ManyToOne(() => CentroCosto, { nullable: true })
  @JoinColumn({ name: 'centroCostoId' })
  centroCosto: CentroCosto;

  @Column({ nullable: true })
  centroCostoId: string;

  @Column({ type: 'date' })
  fechaIngreso: Date;

  @Column({ type: 'date', nullable: true })
  fechaRetiro: Date;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'enum', enum: AreaEmpleado, default: AreaEmpleado.ADMINISTRATIVA })
  area: AreaEmpleado;

  @ManyToOne(() => TipoContratoEntity, { nullable: true })
  @JoinColumn({ name: 'tipoContratoId' })
  tipoContratoRel: TipoContratoEntity;

  @Column({ nullable: true })
  tipoContratoId: string;

  @Column({ type: 'enum', enum: TipoContrato })
  tipoContrato: TipoContrato;

  @ManyToOne(() => Cargo, { nullable: true })
  @JoinColumn({ name: 'cargoId' })
  cargo: Cargo;

  @Column({ nullable: true })
  cargoId: string;

  @Column('decimal', { precision: 15, scale: 2 })
  salarioBase: number;

  @Column({ default: false })
  salarioIntegral: boolean;

  @ManyToOne(() => EntidadSeguridadSocial)
  @JoinColumn({ name: 'epsId' })
  eps: EntidadSeguridadSocial;

  @Column()
  epsId: string;

  @ManyToOne(() => EntidadSeguridadSocial)
  @JoinColumn({ name: 'afpId' })
  afp: EntidadSeguridadSocial;

  @Column()
  afpId: string;

  @ManyToOne(() => EntidadSeguridadSocial, { nullable: true })
  @JoinColumn({ name: 'ccfId' })
  ccf: EntidadSeguridadSocial;

  @Column({ nullable: true })
  ccfId: string;

  @Column({ default: 1 })
  arlNivelRiesgo: number;

  @Column({ default: false })
  auxilioTransporte: boolean;

  @Column({ nullable: true })
  metodoPago: string;

  @ManyToOne(() => Banco, { nullable: true })
  @JoinColumn({ name: 'bancoId' })
  banco: Banco;

  @Column({ nullable: true })
  bancoId: string;

  @Column({ nullable: true })
  tipoCuentaBancaria: string;

  @Column({ nullable: true })
  numeroCuentaBancaria: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
