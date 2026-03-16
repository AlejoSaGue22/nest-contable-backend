import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Proveedor } from "../../proveedores/entities/proveedor.entity";
import { FacturaCompraDetalle } from "./factura-compra-detalle.entity";
import { User } from "src/users/entities/user.entity";
import { Pago } from "src/pagos/entities/pago.entity";
import { PaymentStatus } from "src/pagos/enums/pago.enum";
import { FormaPago } from "../../facturas-ventas/enums/factura-venta.enum";


export enum GastoEstado {
    BORRADOR = 'borrador',
    ERROR_ASIENTO = 'error_asiento',
    REGISTRADO = 'registrado',
    ANULADO = 'anulado'
}

@Entity('facturas_compras')
export class FacturaCompra {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    numero: string;

    @Column({ type: 'date' })
    fecha: Date;

    @ManyToOne(() => Proveedor)
    proveedor: Proveedor;  

    @Column()
    proveedorId: string;

    @Column({ nullable: true })
    observaciones: string;

    @Column({ type: 'enum', enum: FormaPago, default: FormaPago.CREDITO })
    formaPago: FormaPago;

    @Column({ nullable: true })
    metodoPago: string;

    @Column({ type: 'date', nullable: true })
    fechaVencimiento: Date;

    @Column({ type: 'enum', enum: GastoEstado, default: GastoEstado.BORRADOR })
    estado: GastoEstado;

    @Column({ nullable: true })
    asientoError?: string;

    @Column({ nullable: true })
    fechaAsientoError?: Date;

    @OneToMany(() => FacturaCompraDetalle, detalle => detalle.facturaCompra, { cascade: true })
    items: FacturaCompraDetalle[];

    @Column('int')
    subtotal: number;

    @Column('int')
    descuento: number;

    @Column('int')
    iva: number;

    @Column('int')
    total: number;

    @Column({ nullable: true })
    numeroFacturaProveedor: string;

    // ══════════════════════════════════════════════════════
    // ✅ NUEVOS CAMPOS: SEGUIMIENTO DE PAGOS (CxP)
    // Completamente independientes del estado de la factura
    // ══════════════════════════════════════════════════════

    /**
     * Estado del pago — INDEPENDIENTE de GastoEstado.
     *
     * GastoEstado  → flujo contable (BORRADOR, REGISTRADO, ANULADO...)
     * PaymentStatus → flujo de pago (cuánto debemos, si venció)
     *
     * Solo aplica cuando formaPago = 'CREDITO'.
     */
    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    paymentStatus: PaymentStatus;

    /**
     * Suma de todos los pagos registrados en la tabla `pagos`.
     * Se actualiza cada vez que se registra un pago.
     */
    @Column('int', { default: 0 })
    totalPagado: number;

    /**
     * Saldo pendiente = total - totalPagado.
     * Se recalcula automáticamente al registrar cada pago.
     */
    @Column('int', { default: 0 })
    saldoPendiente: number;

    /** Relación para acceder al historial de pagos de esta compra */
    @OneToMany(() => Pago, pago => pago.facturaCompra)
    pagos: Pago[];

    @ManyToOne(() => User)
    createdBy: User;

    @Column()
    createdById: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
    
    
    
    // ========== MÉTODOS HELPER ==========
    
      /**
       * Verifica si el documento puede ser editado
       */
      puedeEditarse(): boolean {
          return this.estado === GastoEstado.BORRADOR;
      }
    
      /**
       * Verifica si puede ser anulado
       */
      puedeAnularse(): boolean {
          return this.estado === GastoEstado.REGISTRADO;
      }
    
      /**
       * Verifica si puede ser pagado
       */
      puedePagarse(): boolean {
          return this.estado === GastoEstado.REGISTRADO;
      }
    
      /**
       * Verifica si puede ser registrado
       */
      puedeRegistrarse(): boolean {
          return this.estado === GastoEstado.BORRADOR;
      }
}


