import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { TipoConceptoNomina } from '../enums/tipo-concepto.enum';
import { CategoriaConceptoNomina } from '../enums/categoria-concepto.enum';

@Entity('conceptos_nomina')
export class ConceptoNomina {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @Column()
  codigo: string;

  @Column()
  nombre: string;

  @Column({ type: 'enum', enum: TipoConceptoNomina })
  tipo: TipoConceptoNomina;

  @Column({ type: 'enum', enum: CategoriaConceptoNomina })
  categoria: CategoriaConceptoNomina;

  @Column({ default: true })
  aplicaIbc: boolean;

  @Column({ default: true })
  aplicaPrestaciones: boolean;

  @Column({ nullable: true })
  cuentaContableDebito: string;

  @Column({ nullable: true })
  cuentaContableCredito: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
