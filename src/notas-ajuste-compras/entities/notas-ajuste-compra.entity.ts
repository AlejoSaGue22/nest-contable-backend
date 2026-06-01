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
import { TipoNotaCompra, EstadoNotaCompra } from "../enums/notas-ajuste-compra.enum";
import { ItemNotaAjusteCompra } from "./items-notas-ajuste-compra.entity";
import { FacturaCompra } from "src/facturas-compras/entities/factura-compra.entity";
import { MetodoPago } from "src/core/catalogs/entities/metodo-pago.entity";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";

@Entity('notas_ajuste_compras')
export class NotaAjusteCompra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ 
    type: 'enum', 
    enum: TipoNotaCompra 
  })
  tipo: TipoNotaCompra;

  @Column()
  prefijo: string;

  @Column({ nullable: true })
  numero: string;

  @Column({ nullable: true })
  numeroCompleto: string; // NC-00001234 o ND-00001234

  @ManyToOne(() => FacturaCompra, { eager: true })
  facturaOriginal: FacturaCompra;

  @Column()
  facturaOriginalId: string;

  @Column()
  facturaOriginalNumero: string;

  @ManyToOne(() => Proveedor, { eager: true })
  proveedor: Proveedor;

  @Column()
  proveedorId: string;

  @Column('text')
  motivo: string;

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
  esReembolsoAbono: boolean; // Solo para NC, indica si es reembolso/abono a favor del proveedor

  @OneToMany(() => ItemNotaAjusteCompra, item => item.nota, { cascade: true })
  items: ItemNotaAjusteCompra[];

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
      [EstadoNotaCompra.ISSUED]: 'Emitida',
      [EstadoNotaCompra.CANCELLED]: 'Anulada',
      [EstadoNotaCompra.ERROR_ASIENTO]: 'Error Asiento'
    };
    return estados[this.estado] || this.estado;
  }
}
