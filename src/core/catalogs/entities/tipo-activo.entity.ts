import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tipos_activo')
export class TipoActivo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column('boolean', { default: true })
  state: boolean;
}
