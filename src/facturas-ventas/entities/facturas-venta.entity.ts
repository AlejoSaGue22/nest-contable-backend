import { Cliente } from "src/clientes/entities/cliente.entity";
import { User } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ItemsFacturaVenta } from "./items-facturas-venta.entity";
import { MetodoPago } from "src/core/catalogs/entities/metodo-pago.entity";
import { CanalVenta } from "src/core/catalogs/entities/canal-venta.entity";
import { Pago } from "src/pagos/entities/pago.entity";
import { PaymentStatus } from "src/pagos/enums/pago.enum";
import { DianStatus, FormaPago, InvoiceStatus, TipoFactura } from "../enums/factura-venta.enum";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";

@Entity('facturas_venta')
export class FacturasVenta {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: 'enum',
    enum: TipoFactura,
    default: TipoFactura.STANDARD
  })
  tipoFactura: TipoFactura;

  @Column()
  prefijo: string;

  @Column()
  comprobante: string;

  @Column()
  comprobante_completo: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'enum', enum: DianStatus, default: DianStatus.PENDING })
  dianStatus: DianStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendedor: string | null;

  @ManyToOne(() => CanalVenta)
  @JoinColumn({ name: 'canalVenta', referencedColumnName: 'id' })
  canalVentaRel: CanalVenta;
 
  @Column()
  canalVenta: number;

  @Column({ type: 'enum', enum: FormaPago, default: FormaPago.CONTADO })
  formaPago: FormaPago;

  @ManyToOne(() => MetodoPago)
  @JoinColumn({ name: 'metodoPago', referencedColumnName: 'id' })
  metodoPagoRel: MetodoPago;

  @Column({ nullable: true })
  metodoPago: string | null; 

  @Column({ type: 'date', nullable: true })
  fechaVencimiento: Date | null;

  @Column({ type: 'date' }) 
  fecha: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  asientoError: string | null;

  @Column({ nullable: true })
  fechaAsientoError?: Date;

  // Items de la factura
  @OneToMany(() => ItemsFacturaVenta, item => item.factura)
  items: ItemsFacturaVenta[];

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  iva: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  descuento: number;

  @ManyToOne(() => Cliente)
  client: Cliente;

  @Column()
  clientId: string;

  // Totales (calculados automáticamente)
  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  subtotal: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  total: number;

  /**
   * Estado del pago — INDEPENDIENTE de InvoiceStatus.
   *
   * InvoiceStatus → flujo contable/DIAN
   * PaymentStatus → flujo de cobro (quién debe, cuánto, si venció)
   *
   * Solo aplica cuando formaPago = CREDITO.
   * Cuando formaPago = CONTADO, se puede dejar null o PAID directamente.
   */
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  /**
   * Suma de todos los abonos registrados en la tabla `pagos`.
   * Se actualiza cada vez que se registra un cobro.
   */
  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  totalPagado: number;

  /**
   * Saldo pendiente = total - totalPagado.
   * Se calcula y guarda cada vez que se registra un cobro.
   */
  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  saldoPendiente: number;

  /** Relación para acceder al historial de cobros de esta factura */
  @OneToMany(() => Pago, pago => pago.facturaVenta)
  pagos: Pago[];


  // ========== FACTURACIÓN ELECTRÓNICA DIAN ==========

  @Column({ nullable: true })
  cufe: string;

  @Column({ nullable: true })
  xmlUrl: string;

  @Column({ nullable: true })
  pdfUrl: string;

  @Column({ type: 'text', nullable: true })
  qrCode: string;

  @Column({ type: 'json', nullable: true })
  proveedorResponse: any;

  @Column({ type: 'json', nullable: true })
  dianResponse: any;

  /**
   * Mensaje de error si fue rechazada
   */
  @Column({ type: 'text', nullable: true })
  mensajeError: string;

  /**
   * Fecha de envío a DIAN
   */
  @Column({ type: 'timestamp', nullable: true })
  fechaEnvioDIAN: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaAceptacionDIAN: Date;

  @Column({ default: 0 })
  intentosEnvio: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @ManyToOne(() => User, (user) => user.id)
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;


  // ========== MÉTODOS HELPER ==========

  /**
   * Verifica si el documento puede ser editado
   */
  puedeEditarse(): boolean {
    return this.status === InvoiceStatus.DRAFT;
  }

  /**
   * Verifica si puede ser emitida (enviada a DIAN)
   */
  puedeEmitirse(): boolean {
    return this.status === InvoiceStatus.DRAFT &&
      this.dianStatus === DianStatus.PENDING;
  }

  /**
   * Verifica si está aceptada por DIAN
  */
  estaAceptada(): boolean {
    return this.status === InvoiceStatus.ACCEPTED &&
      this.dianStatus === DianStatus.ACCEPTED &&
      this.cufe !== null;
  }

  /**
   * Verifica si puede reintentarse el envío
   */
  puedeReintentarse(): boolean {
    return (this.status === InvoiceStatus.REJECTED ||
      this.dianStatus === DianStatus.REJECTED) &&
      this.intentosEnvio < 3;
  }

  /**
   * Obtiene el nombre legible del estado
   */
  obtenerEstadoLegible(): string {
    const estados = {
      [InvoiceStatus.DRAFT]: 'Borrador',
      [InvoiceStatus.PENDING_DIAN]: 'Enviando a DIAN',
      [InvoiceStatus.ACCEPTED]: 'Aceptada por DIAN',
      [InvoiceStatus.REJECTED]: 'Rechazada por DIAN',
      [InvoiceStatus.PAID]: 'Pagada',
      [InvoiceStatus.CANCELLED]: 'Anulada'
    };
    return estados[this.status] || this.status;
  }

  /**
   * Verifica si puede ser anulada
   */
  puedeAnularseElectronica(): boolean {
    // Solo se pueden anular facturas aceptadas por DIAN
    // mediante nota crédito electrónica
    return this.status === InvoiceStatus.ACCEPTED && this.tipoFactura === TipoFactura.ELECTRONICA;
  }

  /**
   * Verifica si puede ser anulada
   */
  puedeAnularseEstandar(): boolean {
    // Solo se pueden anular facturas aceptadas por DIAN
    // mediante nota crédito electrónica
    return this.status === InvoiceStatus.ACCEPTED && this.tipoFactura === TipoFactura.STANDARD;
  }


  /**
   * ¿Se puede registrar un cobro en esta factura?
   * La factura debe estar emitida/aceptada Y a crédito Y tener saldo pendiente.
   */
  puedeRegistrarCobro(): boolean {
    const estadosValidos: InvoiceStatus[] = [
      InvoiceStatus.ISSUED,
      InvoiceStatus.ACCEPTED,
    ];
    return (
      estadosValidos.includes(this.status) &&
      this.formaPago === FormaPago.CREDITO &&
      this.saldoPendiente > 0
    );
  }

  /**
   * Verifica si es factura electrónica
   */
  esElectronica(): boolean {
    return this.tipoFactura === TipoFactura.ELECTRONICA;
  }

}



