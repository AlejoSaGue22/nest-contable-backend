import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { User } from 'src/users/entities/user.entity';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { PagoFacturaDetalle } from './pago-factura-detalle.entity';
import { PagoConceptoDetalle } from './pago-concepto-detalle.entity';

import { MetodoPago } from 'src/core/catalogs/entities/metodo-pago.entity';

import { PaymentStatus, TipoPago, MedioPago } from '../enums/pago.enum';

/**
 * Tabla central de pagos/cobros.
 *
 * Cada registro es UN abono (puede haber varios por factura si es crédito con abonos).
 * Genera automáticamente su propio asiento contable.
 */
@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: '0000' })
  numero: string;

  @Column({ type: 'enum', enum: TipoPago })
  tipo: TipoPago;

  // ── Relaciones con Terceros ──────────────────────────────────────────────
  @ManyToOne(() => Cliente, { nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @Column({ nullable: true })
  clienteId: string | null;

  @ManyToOne(() => Proveedor, { nullable: true })
  @JoinColumn({ name: 'proveedorId' })
  proveedor: Proveedor;

  @Column({ nullable: true })
  proveedorId: string | null;

  // ── Detalles de Pagos (Dos tablas) ───────────────────────────────────────
  @OneToMany(() => PagoFacturaDetalle, (detalle) => detalle.pago)
  facturasDetalles: PagoFacturaDetalle[];

  @OneToMany(() => PagoConceptoDetalle, (detalle) => detalle.pago)
  conceptosDetalles: PagoConceptoDetalle[];

  // ── Referencia al documento origen (solo uno estará lleno) ──────────────
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

  // ── Datos del pago ───────────────────────────────────────────────────────
  @Column({ type: 'date' })
  fecha: Date;

  /** Monto de ESTE abono (no el total de la factura) */
  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  monto: number;

  @Column({ type: 'enum', enum: MedioPago })
  medioPago: MedioPago;

  @ManyToOne(() => MetodoPago, { nullable: true })
  @JoinColumn({ name: 'metodoPagoId' })
  metodoPago: MetodoPago;

  @Column({ type: 'int', nullable: true })
  metodoPagoId: number | null;

  /**
   * Si medioPago = BANCO | TRANSFERENCIA | CHEQUE,
   * referencia qué cuenta bancaria se usó.
   */
  @ManyToOne(() => CuentasBancarias, { nullable: true, eager: true })
  @JoinColumn({ name: 'cuentaBancariaId' })
  cuentaBancaria: CuentasBancarias;

  @Column({ nullable: true })
  cuentaBancariaId: string | null;

  /** Número de transferencia, cheque, comprobante, etc. */
  @Column({ type: 'varchar', nullable: true })
  referencia: string | null;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  // ── Asiento contable generado ────────────────────────────────────────────
  /**
   * ID del asiento contable generado automáticamente por este pago.
   * Guardamos el ID (string) del asiento para trazabilidad.
   */
  @Column({  nullable: true })
  asientoId: string;

  // ── Auditoría ────────────────────────────────────────────────────────────
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User;

  @Column()
  creadoPorId: string;

  @CreateDateColumn()
  createdAt: Date;
}