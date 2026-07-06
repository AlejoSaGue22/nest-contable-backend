import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';
import { Pago } from './pago.entity';

@Entity('pago_concepto_detalles')
export class PagoConceptoDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Pago, (pago) => pago.conceptosDetalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pagoId' })
  pago: Pago;

  @Column()
  pagoId: string;

  @ManyToOne(() => CuentaContable, { nullable: false })
  @JoinColumn({ name: 'cuentaContableId' })
  cuentaContable: CuentaContable;

  @Column()
  cuentaContableId: string;

  @Column({ type: 'varchar' })
  concepto: string;

  @Column({ type: 'integer', default: 1 })
  cantidad: number;

  @Column('decimal', {
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  valorUnitario: number;

  @Column('decimal', {
    precision: 5,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
    default: 0,
  })
  impuestoPorcentaje: number;

  @ManyToOne(() => Impuesto, { nullable: true })
  @JoinColumn({ name: 'impuestoId' })
  impuesto: Impuesto;

  @Column({ nullable: true })
  impuestoId: string | null;

  @Column('decimal', {
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  total: number;
}
