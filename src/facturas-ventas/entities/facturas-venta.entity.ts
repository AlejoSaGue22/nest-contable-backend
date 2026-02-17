import { Cliente } from "src/clientes/entities/cliente.entity";
import { User } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ItemsFacturaVenta } from "./items-facturas-venta.entity";

export enum FacturaEstado {
  BORRADOR = 'borrador',
  EMITIDO = 'emitido',
  CANCELADO = 'cancelado',
  PAGADO = 'pagado'
}

export enum InvoiceType {
  SALE = 'sale', // Venta
  ELECTRONIC = 'electronic' // Electronica
}

export enum InvoiceStatus {
  DRAFT = 'draft', // Borrador
  ISSUED = 'issued', // Emitido
  ERROR_ASIENTO = 'error_asiento', // Error en asiento
  CANCELLED = 'cancelled', // Cancelado
  PAID = 'paid' // Pagado
}

export enum DianStatus {
  PENDING = 'pending', // Pendiente
  ACCEPTED = 'accepted', // Aceptado
  REJECTED = 'rejected' // Rechazado
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

  @Column({ nullable: true })
  vendedor: string;

  @Column()
  canalventa: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column()
  formapago: string;

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

  // Campos DIAN
  @Column({ nullable: true })
  cufe: string;

  // @Column({ type: 'jsonb', nullable: true })
  // dianResponse: any;

  @Column({ type: 'enum', enum: DianStatus, default: DianStatus.PENDING })
  dianStatus: DianStatus;

  @ManyToOne(() => User, (user) => user.id)
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

}



