import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  JoinColumn, 
  ManyToOne, 
  OneToMany, 
  PrimaryGeneratedColumn,
  UpdateDateColumn 
} from "typeorm";
import { User } from "src/users/entities/user.entity";
import { Cliente } from "src/clientes/entities/cliente.entity";
import { TipoNota, EstadoNota, EstadoDIANNota, ConceptoNotaCredito } from "../enums/notas-ajuste.enum";
import { ItemNotaAjuste } from "./items-notas-ajuste.entity";
import { FacturasVenta } from "src/facturas-ventas/entities/facturas-venta.entity";
import { MetodoPago } from "src/core/catalogs/entities/metodo-pago.entity";

/**
 * Entidad para Notas de Ajuste (Crédito y Débito)
 */
@Entity('notas_ajuste')
export class NotaAjuste {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ========== TIPO Y NÚMERO ==========

  @Column({ 
    type: 'enum', 
    enum: TipoNota 
  })
  tipo: TipoNota;

  @Column()
  prefijo: string;

  @Column()
  numero: string;

  @Column()
  numeroCompleto: string; // NC-00001234 o ND-00001234

  // ========== FACTURA RELACIONADA ==========

  /**
   * Factura que se está ajustando
   */
  @ManyToOne(() => FacturasVenta, { eager: true })
  facturaOriginal: FacturasVenta;

  @Column()
  facturaOriginalId: string;

  /**
   * Número de la factura original (para referencia)
   */
  @Column()
  facturaOriginalNumero: string;

  // ========== CLIENTE ==========

  @ManyToOne(() => Cliente, { eager: true })
  cliente: Cliente;

  @Column()
  clienteId: string;

  /**
   * Concepto según DIAN
   */
  @Column({ nullable: true })
  concepto: string; // ConceptoNotaCredito o ConceptoNotaDebito

  @Column('text')
  motivo: string;

  @ManyToOne(() => MetodoPago)
  @JoinColumn({ name: 'metodoPago', referencedColumnName: 'id' })
  metodoPagoRelacion: MetodoPago;

  @Column({ nullable: true })
  metodoPago: string;

  @Column({ type: 'date' })
  fecha: Date;

  @OneToMany(() => ItemNotaAjuste, item => item.nota)
  items: ItemNotaAjuste[];

  @Column('decimal', { precision: 15, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 15, scale: 2 })
  iva: number;

  @Column('decimal', { precision: 15, scale: 2 })
  descuento: number;

  @Column('decimal', { precision: 15, scale: 2 })
  total: number;

  /**
   * Saldo pendiente (si la nota es parcial)
   */
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  saldoPendiente: number;

  @Column({ 
    type: 'enum', 
    enum: EstadoNota,
    default: EstadoNota.DRAFT 
  })
  estado: EstadoNota;

  @Column({ 
    type: 'enum', 
    enum: EstadoDIANNota,
    default: EstadoDIANNota.PENDIENTE 
  })
  estadoDIAN: EstadoDIANNota;

  // ========== CAMPOS DIAN ==========

  /**
   * CUFE de la nota de ajuste
   */
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

  @Column({ type: 'text', nullable: true })
  mensajeError: string;

  @Column({ type: 'timestamp', nullable: true })
  fechaEnvioDIAN: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaAceptacionDIAN: Date;

  @Column({ default: 0 })
  intentosEnvio: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  // ========== AUDITORÍA ==========

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
   * Verifica si es nota crédito
   */
  esNotaCredito(): boolean {
    return this.tipo === TipoNota.CREDITO;
  }

  /**
   * Verifica si es nota débito
   */
  esNotaDebito(): boolean {
    return this.tipo === TipoNota.DEBITO;
  }

  /**
   * Verifica si puede ser enviada a DIAN
   */
  puedeEnviarse(): boolean {
    return this.estado === EstadoNota.DRAFT;
  }

  /**
   * Verifica si está aceptada por DIAN
   */
  estaAceptada(): boolean {
    return this.estado === EstadoNota.ACCEPTED &&
           this.estadoDIAN === EstadoDIANNota.ACEPTADA &&
           this.cufe !== null;
  }

  /**
   * Verifica si puede reintentarse
   */
  puedeReintentarse(): boolean {
    return this.estado === EstadoNota.REJECTED &&
           this.intentosEnvio < 3;
  }

  /**
   * Verifica si afecta inventario (para futuras implementaciones)
   */
  afectaInventario(): boolean {
    if (this.esNotaCredito()) {
      // NC por devolución afecta inventario
      return this.concepto === ConceptoNotaCredito.DEVOLUCION_PARCIAL;
    }
    return false;
  }

  /**
   * Obtiene el nombre legible del estado
   */
  obtenerEstadoLegible(): string {
    const estados = {
      [EstadoNota.DRAFT]: 'Borrador',
      [EstadoNota.SENT]: 'Enviada a DIAN',
      [EstadoNota.PROCESSING]: 'DIAN Procesando',
      [EstadoNota.ACCEPTED]: 'Aceptada por DIAN',
      [EstadoNota.REJECTED]: 'Rechazada por DIAN',
      [EstadoNota.CANCELLED]: 'Anulada'
    };
    return estados[this.estado] || this.estado;
  }

  /**
   * Obtiene el impacto en la factura original
   */
  obtenerImpacto(): number {
    if (this.esNotaCredito()) {
      return -Number(this.total); // Disminuye
    } else {
      return Number(this.total); // Aumenta
    }
  }

  /**
   * Calcula el nuevo saldo de la factura
   */
  calcularNuevoSaldoFactura(saldoActual: number): number {
    return saldoActual + this.obtenerImpacto();
  }
}
