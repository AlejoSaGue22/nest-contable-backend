import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ActivoFijo } from './activo-fijo.entity';
import { AsientoContable } from '../../asientos-contables/entities/asientos-contable.entity';
import { Empresa } from '../../settings/empresa/entities/empresa.entity';
import { ColumnNumericTransformer } from '../../common/transformers/column-numeric.transformer';

@Entity({ name: 'depreciaciones_activos_fijos' })
export class DepreciacionActivoFijo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @ManyToOne(() => ActivoFijo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activoFijoId' })
  activoFijo: ActivoFijo;

  @Column()
  activoFijoId: string;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'int' })
  mes: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  monto: number;

  @ManyToOne(() => AsientoContable)
  @JoinColumn({ name: 'asientoContableId' })
  asientoContable: AsientoContable;

  @Column()
  asientoContableId: string;

  @CreateDateColumn()
  createdAt: Date;
}
