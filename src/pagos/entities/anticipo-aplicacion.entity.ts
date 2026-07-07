import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Anticipo } from './anticipo.entity';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { User } from 'src/users/entities/user.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';

export enum AplicacionEstado {
  BORRADOR = 'borrador',
  ACTIVO = 'activo',
  REVERTIDO = 'revertido',
}

@Entity('anticipos_aplicaciones')
export class AnticipoAplicacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Anticipo, { nullable: false })
  @JoinColumn({ name: 'anticipoId' })
  anticipo: Anticipo;

  @Column()
  anticipoId: string;

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

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  montoAplicado: number;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  asientoId: string | null;

  @Column({ type: 'enum', enum: AplicacionEstado, default: AplicacionEstado.ACTIVO })
  estado: AplicacionEstado;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User;

  @Column()
  creadoPorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
