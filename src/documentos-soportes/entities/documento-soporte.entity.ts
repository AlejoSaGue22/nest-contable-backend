import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Proveedor } from "../../proveedores/entities/proveedor.entity";
import { DocumentoSoporteDetalle } from "./documento-soporte-detalle.entity";
import { User } from "src/users/entities/user.entity";
import { Empresa } from "src/settings/empresa/entities/empresa.entity";
import { Pago } from "src/pagos/entities/pago.entity";
import { PaymentStatus } from "src/pagos/enums/pago.enum";
import { FormaPago } from "../../facturas-ventas/enums/factura-venta.enum";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";
import { MetodoPago } from "src/core/catalogs/entities/metodo-pago.entity";
import { CuentasBancarias } from "src/cuentas-bancarias/entities/cuentas-bancaria.entity";

export enum DocumentoSoporteEstado {
    BORRADOR = 'borrador',
    ERROR_ASIENTO = 'error_asiento',
    REGISTRADO = 'registrado',
    ANULADO = 'anulado'
}

export enum TipoDocumentoSoporte {
    ESTANDAR = 'estandar',
    ELECTRONICO = 'electronico'
}

export enum DianStatusSoporte {
    PENDING = 'pending',
    SENT = 'sent',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected'
}

@Entity('documentos_soporte')
export class DocumentoSoporte {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Empresa, { nullable: true })
    @JoinColumn({ name: 'empresaId' })
    empresa: Empresa;

    @Column({ nullable: true })
    empresaId: string;

    /** Consecutivo interno local (DS-000001). Se asigna al registrar/emitir. */
    @Column({ type: 'varchar', length: 255, nullable: true })
    numero: string | null;

    @Column({ type: 'date' })
    fecha: Date;

    @ManyToOne(() => Proveedor)
    @JoinColumn({ name: 'proveedorId', referencedColumnName: 'id' })
    proveedor: Proveedor;

    @Column()
    proveedorId: string;

    @Column({ type: 'enum', enum: TipoDocumentoSoporte, default: TipoDocumentoSoporte.ESTANDAR })
    tipo: TipoDocumentoSoporte;

    @Column({ nullable: true })
    observaciones: string;

    @Column({ type: 'enum', enum: FormaPago, default: FormaPago.CREDITO })
    formaPago: FormaPago;

    @ManyToOne(() => MetodoPago)
    @JoinColumn({ name: 'metodoPago', referencedColumnName: 'codigo' })
    metodoPagoRel: MetodoPago;

    @Column({ type: 'varchar', length: 255, nullable: true })
    metodoPago: string | null;

    @ManyToOne(() => CuentasBancarias, { nullable: true, eager: true })
    @JoinColumn({ name: 'cuentaBancariaId' })
    cuentaBancaria: CuentasBancarias;

    @Column({ type: 'uuid', nullable: true })
    cuentaBancariaId: string | null;

    @Column({ type: 'date', nullable: true })
    fechaVencimiento: Date | null;

    @Column({ type: 'enum', enum: DocumentoSoporteEstado, default: DocumentoSoporteEstado.BORRADOR })
    estado: DocumentoSoporteEstado;

    @Column({ type: 'varchar', length: 255, nullable: true })
    asientoError?: string | null;

    @Column({ nullable: true })
    fechaAsientoError?: Date;

    @OneToMany(() => DocumentoSoporteDetalle, detalle => detalle.documentoSoporte, { cascade: true })
    items: DocumentoSoporteDetalle[];

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    subtotal: number;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    descuento: number;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    iva: number;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    total: number;

    /** Referencia del comprobante del proveedor no obligado a facturar. */
    @Column({ nullable: true })
    numeroFacturaProveedor: string;

    // ── Modo de generación DIAN (items.*.period) ──
    /** '1' por operación (compra del día) | '2' acumulado semanal */
    @Column({ type: 'varchar', length: 2, default: '1' })
    generationMode: string;

    /** Requerida solo si generationMode = '2' (máx. 6 días antes de hoy). */
    @Column({ type: 'date', nullable: true })
    periodStartDate: Date | string | null;

    // ── Trazabilidad DIAN (solo ELECTRONICO) ──
    /** Código único de idempotencia ante Factus. */
    @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
    referenceCode: string | null;

    /** Número oficial DIAN (SEDS…). */
    @Column({ type: 'varchar', length: 255, nullable: true })
    numeroDian: string | null;

    @Column({ type: 'enum', enum: DianStatusSoporte, default: DianStatusSoporte.PENDING })
    dianStatus: DianStatusSoporte;

    @Column({ nullable: true })
    fechaEnvioDIAN: Date;

    @Column({ nullable: true })
    fechaAceptacionDIAN: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    cuds: string | null;

    @Column({ type: 'text', nullable: true })
    qrCode: string | null;

    @Column({ type: 'text', nullable: true })
    qrImageBase64: string | null;

    @Column({ type: 'text', nullable: true })
    publicUrl: string | null;

    @Column({ type: 'text', nullable: true })
    xmlUrl: string | null;

    @Column({ type: 'text', nullable: true })
    pdfUrl: string | null;

    @Column({ type: 'jsonb', nullable: true })
    dianResponse: any;

    @Column({ type: 'text', nullable: true })
    mensajeError: string | null;

    @Column({ type: 'int', default: 0 })
    intentosEnvio: number;

    @Column({ type: 'int', nullable: true })
    factusNumberingRangeId: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    factusResolutionNumber: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    factusRangePrefix: string | null;

    @Column({
        type: 'enum',
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    paymentStatus: PaymentStatus;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    totalPagado: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    saldoPendiente: number;

    @OneToMany(() => Pago, pago => pago.documentoSoporte)
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

    puedeEditarse(): boolean {
        return this.estado === DocumentoSoporteEstado.BORRADOR;
    }

    puedeAnularse(): boolean {
        return this.estado === DocumentoSoporteEstado.REGISTRADO;
    }

    puedeEliminarse(): boolean {
        return this.estado === DocumentoSoporteEstado.BORRADOR;
    }

    puedePagarse(): boolean {
        return this.estado === DocumentoSoporteEstado.REGISTRADO;
    }

    puedeRegistrarse(): boolean {
        return this.estado === DocumentoSoporteEstado.BORRADOR;
    }

    puedeEmitirse(): boolean {
        return this.tipo === TipoDocumentoSoporte.ELECTRONICO
            && this.estado === DocumentoSoporteEstado.BORRADOR;
    }

    /** Validado ante DIAN: bloquea la anulación local. */
    estaValidado(): boolean {
        return this.dianStatus === DianStatusSoporte.ACCEPTED;
    }
}
