import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EntidadSeguridadSocial } from '../../../nomina/entities/entidad-seguridad-social.entity';
import { Municipality } from 'src/core/municipalities/entities/municipality.entity';

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

  /**
   * Municipio de la sede/establecimiento (relación con tabla local de municipios V2).
   * Se usa como municipality_code del establishment en los payloads DIAN/Factus.
   */
  @ManyToOne(() => Municipality, { nullable: true })
  @JoinColumn({ name: 'ciudad', referencedColumnName: 'id' })
  ciudadRel: Municipality;

  @Column({ type: 'int', nullable: true })
  ciudad: number | null;

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
