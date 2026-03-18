import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bancos')
export class Banco {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120, unique: true })
  nombre: string;

  @Column({ length: 10, nullable: true })
  codigo: string;

  @Column({ length: 20, nullable: true })
  nit: string;

  @Column({ default: true })
  activa: boolean;
}
