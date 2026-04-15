import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Proveedor } from "../../proveedores/entities/proveedor.entity";
import { FacturaCompraDetalle } from "./factura-compra-detalle.entity";
import { User } from "src/users/entities/user.entity";
import { Pago } from "src/pagos/entities/pago.entity";
import { PaymentStatus } from "src/pagos/enums/pago.enum";
import { FormaPago } from "../../facturas-ventas/enums/factura-venta.enum";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";
import { MetodoPago } from "src/core/catalogs/entities/metodo-pago.entity";


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

    @Column({ type: 'varchar', length: 255, nullable: true })
    numero: string | null;

    @Column({ type: 'date' })
    fecha: Date;

    @ManyToOne(() => Proveedor)
    @JoinColumn({ name: 'proveedorId', referencedColumnName: 'id' })
    proveedor: Proveedor; 

    @Column()
    proveedorId: string;

    @Column({ nullable: true })
    observaciones: string;

    @Column({ type: 'enum', enum: FormaPago, default: FormaPago.CREDITO })
    formaPago: FormaPago; 

    @ManyToOne(() => MetodoPago)
    @JoinColumn({ name: 'metodoPago', referencedColumnName: 'codigo' })
    metodoPagoRel: MetodoPago;

    @Column({ type: 'varchar', length: 255, nullable: true }) 
    metodoPago: string | null; 

    @Column({ type: 'date', nullable: true })
    fechaVencimiento: Date | null;
 
    @Column({ type: 'enum', enum: GastoEstado, default: GastoEstado.BORRADOR })
    estado: GastoEstado;

    @Column({ type: 'varchar', length: 255, nullable: true })
    asientoError?: string | null;

    @Column({ nullable: true })
    fechaAsientoError?: Date;

    @OneToMany(() => FacturaCompraDetalle, detalle => detalle.facturaCompra, { cascade: true })
    items: FacturaCompraDetalle[];

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    subtotal: number;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    descuento: number;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    iva: number;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    total: number;

    @Column({ nullable: true })
    numeroFacturaProveedor: string;

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
    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    totalPagado: number;

    /**
     * Saldo pendiente = total - totalPagado.
     * Se recalcula automáticamente al registrar cada pago.
     */
    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
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

    @DeleteDateColumn()
    deletedAt: Date;
    
    // ========== MÉTODOS HELPER ==========
    
      /** Verifica si el documento puede ser editado */
      puedeEditarse(): boolean {
          return this.estado === GastoEstado.BORRADOR;
      }
    
      /** Verifica si puede ser anulado */
      puedeAnularse(): boolean {
          return this.estado === GastoEstado.REGISTRADO;
      }

      /** Verifica si puede ser eliminado */
      puedeEliminarse(): boolean {
          return this.estado === GastoEstado.BORRADOR;
      }
    
      /** Verifica si puede ser pagado */
      puedePagarse(): boolean {
          return this.estado === GastoEstado.REGISTRADO;
      }
    
      /** Verifica si puede ser registrado */
      puedeRegistrarse(): boolean {
          return this.estado === GastoEstado.BORRADOR;
      }
}


