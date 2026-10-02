import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { User } from "src/users/entities/user.entity";
import { Proveedor } from "src/proveedores/entities/proveedor.entity";
import { TipoNotaCompra, EstadoNotaCompra } from "src/notas-ajuste-compras/enums/notas-ajuste-compra.enum";
import { ItemNotaAjusteSoporte } from "./item-nota-ajuste-soporte.entity";
import { DocumentoSoporte, DianStatusSoporte } from "src/documentos-soportes/entities/documento-soporte.entity";
import { MetodoPago } from "src/core/catalogs/entities/metodo-pago.entity";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";
import { Empresa } from "src/settings/empresa/entities/empresa.entity";

@Entity('notas_ajuste_soporte')
export class NotaAjusteSoporte {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @Column({
    type: 'enum',
    enum: TipoNotaCompra
  })
  tipo: TipoNotaCompra;

  @Column()
  prefijo: string;

  @Column({ nullable: true })
  numero: string;

  /** NACS-… local o número oficial DIAN de la nota de ajuste. */
  @Column({ nullable: true })
  numeroCompleto: string;

  @ManyToOne(() => DocumentoSoporte, { eager: true })
  documentoOriginal: DocumentoSoporte;

  @Column()
  documentoOriginalId: string;

  /** Número local o DIAN del DSE origen (snapshot informativo). */
  @Column()
  documentoOriginalNumero: string;

  @ManyToOne(() => Proveedor, { eager: true })
  proveedor: Proveedor;

  @Column()
  proveedorId: string;

  @Column('text')
  motivo: string;

  /** Código DIAN del motivo de corrección (correction_concept_code). */
  @Column({ type: 'varchar', length: 10, nullable: true })
  conceptoCorreccion: string | null;

  @Column()
  formaPago: string;

  @ManyToOne(() => MetodoPago)
  @JoinColumn({ name: 'metodoPago', referencedColumnName: 'codigo' })
  metodoPagoRelacion: MetodoPago;

  @Column({ type: 'varchar', length: 255, nullable: true })
  metodoPago: string | null;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'boolean', nullable: true })
  esReembolsoAbono: boolean;

  @Column({ type: 'boolean', default: false })
  saldoAplicado: boolean;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  valorAplicadoCartera: number | null;

  @OneToMany(() => ItemNotaAjusteSoporte, item => item.nota, { cascade: true })
  items: ItemNotaAjusteSoporte[];

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  subtotal: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  iva: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  descuento: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  total: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  saldoPendiente: number;

  @Column({
    type: 'enum',
    enum: EstadoNotaCompra,
    default: EstadoNotaCompra.DRAFT
  })
  estado: EstadoNotaCompra;

  @Column({ type: 'varchar', length: 255, nullable: true })
  asientoError: string | null;

  @Column({ nullable: true })
  fechaAsientoError?: Date;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  // ── Trazabilidad DIAN (solo si el DSE origen es electrónico) ──
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  referenceCode: string | null;

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
  publicUrl: string | null;

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

  esNotaCredito(): boolean {
    return this.tipo === TipoNotaCompra.CREDITO;
  }

  esNotaDebito(): boolean {
    return this.tipo === TipoNotaCompra.DEBITO;
  }

  puedeEliminarse(): boolean {
    return this.estado === EstadoNotaCompra.DRAFT;
  }

  obtenerEstadoLegible(): string {
    const estados = {
      [EstadoNotaCompra.DRAFT]: 'Borrador',
      [EstadoNotaCompra.REGISTERED]: 'Registrada',
      [EstadoNotaCompra.CANCELLED]: 'Anulada',
      [EstadoNotaCompra.ERROR_ASIENTO]: 'Error Asiento'
    };
    return estados[this.estado] || this.estado;
  }

  estaValidada(): boolean {
    return this.dianStatus === DianStatusSoporte.ACCEPTED;
  }
}
