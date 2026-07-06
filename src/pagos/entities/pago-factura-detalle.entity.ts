import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';
import { Pago } from './pago.entity';

@Entity('pago_factura_detalles')
export class PagoFacturaDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Pago, (pago) => pago.facturasDetalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pagoId' })
  pago: Pago;

  @Column()
  pagoId: string;

  @ManyToOne(() => FacturasVenta, { nullable: true })
  @JoinColumn({ name: 'facturaVentaId' })
  facturaVenta: FacturasVenta;

  @Column({ nullable: true })
  facturaVentaId: string | null;

  @ManyToOne(() => FacturaCompra, { nullable: true })
  @JoinColumn({ name: 'facturaCompraId' })
  facturaCompra: FacturaCompra;

  @Column({ nullable: true })
  facturaCompraId: string | null;

  @Column('decimal', {
    precision: 15,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  monto: number;
}
