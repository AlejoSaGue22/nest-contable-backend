import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('tipos_comprobantes')
export class TipoComprobante {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  codigo: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  prefijo?: string;

  @Column({ type: 'int', default: 1 })
  consecutivoActual: number;

  @Column({ default: true })
  numeracionAutomatica: boolean;

  @Column({ default: true })
  activo: boolean;

  @Column({ default: false })
  requiereAprobacion: boolean;

  @Column({ default: false })
  docReferenciaObligatorio: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
