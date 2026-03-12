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
import { CuentaBancaria } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';

/**
 * Estado de pago INDEPENDIENTE del estado de la factura.
 *
 * InvoiceStatus → controla flujo DIAN / contable (DRAFT, ISSUED, ACCEPTED, CANCELLED...)
 * PaymentStatus → controla flujo de COBRO/PAGO (quién debe, cuánto, si venció)
 */
export enum PaymentStatus {
  PENDING  = 'pending',   // Sin pagos registrados (solo aplica a crédito)
  PARTIAL  = 'partial',   // Abonos parciales, aún hay saldo
  PAID     = 'paid',      // Pagado en su totalidad
  OVERDUE  = 'overdue',   // Venció sin pagar (cron job lo marca)
}

export enum TipoPago {
  COBRO = 'cobro', // Recibimos dinero (venta)
  PAGO  = 'pago',  // Pagamos dinero   (compra)
}

export enum MedioPago {
  CAJA          = 'caja',
  BANCO         = 'banco',
  TRANSFERENCIA = 'transferencia',
  CHEQUE        = 'cheque',
}

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
  @ManyToOne(() => CuentaBancaria, { nullable: true })
  @JoinColumn({ name: 'cuentaBancariaId' })
  cuentaBancaria: CuentaBancaria;

  @Column({ nullable: true })
  cuentaBancariaId: string | null;

  /** Número de transferencia, cheque, comprobante, etc. */
  @Column({ length: 100, nullable: true })
  referencia: string | null;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  // ── Asiento contable generado ────────────────────────────────────────────
  /**
   * ID del asiento contable generado automáticamente por este pago.
   * Guardamos el ID (string) del asiento para trazabilidad.
   */
  @Column({ nullable: true })
  asientoId: string | null;

  // ── Auditoría ────────────────────────────────────────────────────────────
  @ManyToOne(() => User)
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User;

  @Column()
  creadoPorId: string;

  @CreateDateColumn()
  createdAt: Date;
}