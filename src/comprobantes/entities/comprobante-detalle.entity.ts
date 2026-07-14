import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ComprobanteContable } from './comprobante-contable.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { CentroCosto } from 'src/nomina/entities/centro-costo.entity';
import { EntidadSeguridadSocial } from 'src/nomina/entities/entidad-seguridad-social.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';

@Entity('comprobantes_detalles')
export class ComprobanteDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ComprobanteContable, (comprobante) => comprobante.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comprobanteId' })
  comprobante: ComprobanteContable;

  @Column()
  comprobanteId: string;

  @ManyToOne(() => CuentaContable, { eager: true })
  @JoinColumn({ name: 'cuentaContableId' })
  cuentaContable: CuentaContable;

  @Column()
  cuentaContableId: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  debito: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  credito: number;

  // --- Información analítica y de auditoría colombiana ---
  @ManyToOne(() => Cliente, { nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente?: Cliente;

  @Column({ nullable: true })
  clienteId?: string;

  @ManyToOne(() => Proveedor, { nullable: true })
  @JoinColumn({ name: 'proveedorId' })
  proveedor?: Proveedor;

  @Column({ nullable: true })
  proveedorId?: string;

  @ManyToOne(() => EntidadSeguridadSocial, { nullable: true })
  @JoinColumn({ name: 'entidadSSId' })
  entidadSS?: EntidadSeguridadSocial;

  @Column({ nullable: true })
  entidadSSId?: string;

  @ManyToOne(() => CentroCosto, { nullable: true, eager: true })
  @JoinColumn({ name: 'centroCostoId' })
  centroCosto?: CentroCosto;

  @Column({ nullable: true })
  centroCostoId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  documentoReferencia?: string;
}
