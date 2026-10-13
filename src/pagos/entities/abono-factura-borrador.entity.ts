import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { User } from 'src/users/entities/user.entity';
import { MedioPago } from '../enums/pago.enum';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';

export enum AbonoBorradorEstado {
  PENDIENTE = 'pendiente',
  APLICADO = 'aplicado',
  CANCELADO = 'cancelado',
}

/**
 * Intención de cobro capturada mientras la factura aún no está emitida.
 * No representa un movimiento financiero ni aparece en cartera/pagos.
 */
@Entity('abonos_factura_borrador')
export class AbonoFacturaBorrador {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FacturasVenta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'facturaVentaId' })
  facturaVenta: FacturasVenta;

  @Column()
  facturaVentaId: string;

  @Column('decimal', {
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  monto: number;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'varchar', length: 20 })
  medioPago: MedioPago;

  @Column({ type: 'int', nullable: true })
  metodoPagoId: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cuentaBancariaId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string | null;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @Column({ type: 'varchar', length: 20, default: AbonoBorradorEstado.PENDIENTE })
  estado: AbonoBorradorEstado;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User;

  @Column({ type: 'varchar', nullable: true })
  creadoPorId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
