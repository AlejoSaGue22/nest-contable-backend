import { Cliente } from "src/clientes/entities/cliente.entity";
import { User } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ItemsFacturaVenta } from "./items-facturas-venta.entity";

// export enum FacturaEstado {
//   BORRADOR = 'borrador',
//   EMITIDO = 'emitido',
//   CANCELADO = 'cancelado',
//   PAGADO = 'pagado'
// }

export enum TipoFactura {
  ELECTRONICA = 'ELECTRONICA',
  STANDARD = 'STANDARD',
}

export enum FormaPago {
  CONTADO = 'CONTADO',
  CREDITO = 'CREDITO',
}

export enum InvoiceStatus {
  DRAFT = 'draft',              // Borrador - editable
  PENDING_DIAN = 'pending_dian', // Enviando a DIAN
  ACCEPTED = 'accepted',         // Aceptada por DIAN (tiene CUFE)
  REJECTED = 'rejected',         // Rechazada por DIAN (corregir y reenviar)
  PAID = 'paid',                 // Pagada
  CANCELLED = 'cancelled',        // Anulada (requiere nota crédito)
  ISSUED = 'issued',             // Emitida (para facturas comunes)
  ERROR_ASIENTO = 'error_asiento' // Error generado el asiento
}

export enum DianStatus {
  PENDING = 'pending',           // Esperando envío
  SENT = 'sent',                 // Enviada a proveedor tecnológico
  PROCESSING = 'processing',     // Proveedor validando
  ACCEPTED = 'accepted',         // DIAN aprobó (tiene CUFE)
  REJECTED = 'rejected',         // DIAN rechazó
  CANCELLED = 'cancelled'        // Anulada (nota crédito enviada)
}

@Entity('facturas_venta')
export class FacturasVenta {
  @PrimaryGeneratedColumn("uuid")
  id: string;

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

  @Column({ nullable: true })
  vendedor: string;

  @Column()
  canalventa: string;

  @Column({ type: 'enum', enum: TipoFactura, default: TipoFactura.ELECTRONICA })
  tipoFactura: TipoFactura;

  @Column({ type: 'enum', enum: FormaPago, default: FormaPago.CONTADO })
  formaPago: FormaPago;

  @Column({ nullable: true })
  metodoPago: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ nullable: true })
  asientoError: string;

  @Column({ nullable: true })
  fechaAsientoError: Date;

  // Items de la factura
  @OneToMany(() => ItemsFacturaVenta, item => item.factura, { cascade: true })
  items: ItemsFacturaVenta[];

  @Column('int')
  iva: number;

  @Column('int')
  descuento: number;

  @ManyToOne(() => Cliente)
  client: Cliente;

  @Column()
  clientId: string;

  // Totales (calculados automáticamente)
  @Column('int')
  subtotal: number;

  @Column('int')
  total: number;

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
  puedeAnularse(): boolean {
    // Solo se pueden anular facturas aceptadas por DIAN
    // mediante nota crédito electrónica
    return this.status === InvoiceStatus.ACCEPTED;
  }

}



