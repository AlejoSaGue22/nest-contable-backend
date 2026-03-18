import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { User } from 'src/users/entities/user.entity';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';

import { PaymentStatus, TipoPago, MedioPago } from '../enums/pago.enum';

/**
 * Tabla central de pagos/cobros.
 *
 * Cada registro es UN abono (puede haber varios por factura si es crédito con abonos).
 * Genera automáticamente su propio asiento contable.
 *
 * FLUJO:
 *  Factura Venta crédito → PaymentStatus.PENDING
 *    → registrar cobro parcial  → PaymentStatus.PARTIAL  (crea Pago tipo COBRO)
 *    → registrar cobro total    → PaymentStatus.PAID     (crea Pago tipo COBRO)
 *
 *  Factura Compra crédito → PaymentStatus.PENDING
 *    → registrar pago parcial   → PaymentStatus.PARTIAL  (crea Pago tipo PAGO)
 *    → registrar pago total     → PaymentStatus.PAID     (crea Pago tipo PAGO)
 */
@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoPago })
  tipo: TipoPago;

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
  @Column('int')
  monto: number;

  @Column({ type: 'enum', enum: MedioPago })
  medioPago: MedioPago;

  /**
   * Si medioPago = BANCO | TRANSFERENCIA | CHEQUE,
   * referencia qué cuenta bancaria se usó.
   */
  @ManyToOne(() => CuentasBancarias, { nullable: true })
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