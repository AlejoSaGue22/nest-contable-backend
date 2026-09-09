import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadSeguridadSocial } from '../../../nomina/entities/entidad-seguridad-social.entity';

@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  nit: string;

  @Column()
  razonSocial: string;

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column('json', { nullable: true })
  configuracionDian: any;

  @ManyToOne(() => EntidadSeguridadSocial, { nullable: true })
  @JoinColumn({ name: 'arlId' })
  arl: EntidadSeguridadSocial;

  @Column({ nullable: true })
  arlId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
