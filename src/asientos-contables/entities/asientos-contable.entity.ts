import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "src/users/entities/user.entity";
import { AsientoDetalle } from "./asientos-detalles.entity";

export enum TipoAsiento {
  FACTURA_VENTA = 'FACTURA_VENTA',
  GASTO = 'GASTO',
  ANULACION_FACTURA_VENTA = 'ANULACION_FACTURA_VENTA',
  ANULACION_FACTURA_COMPRA = 'ANULACION_FACTURA_COMPRA',
  COBRO = 'COBRO',
  PAGO_PROVEEDOR = 'PAGO_PROVEEDOR',
  ANULACION_COBRO = 'ANULACION_COBRO',
  ANULACION_PAGO_PROVEEDOR = 'ANULACION_PAGO_PROVEEDOR',
  ANULACION_OTROS_INGRESOS = 'ANULACION_OTROS_INGRESOS',
  ANULACION_OTROS_EGRESOS = 'ANULACION_OTROS_EGRESOS',
  NOTA_CREDITO_VENTA = 'NOTA_CREDITO_VENTA',
  NOTA_DEBITO_VENTA = 'NOTA_DEBITO_VENTA',
  NOTA_CREDITO_COMPRA = 'NOTA_CREDITO_COMPRA',
  NOTA_DEBITO_COMPRA = 'NOTA_DEBITO_COMPRA',
  ANULACION_NOTA_COMPRA = 'ANULACION_NOTA_COMPRA',
  SALDO_INICIAL_BANCO = 'SALDO_INICIAL_BANCO',
  TRANSFERENCIA_BANCARIA = 'TRANSFERENCIA_BANCARIA',
  NOMINA = 'NOMINA',
  PAGO_NOMINA = 'PAGO_NOMINA',
  ANULACION_NOMINA = 'ANULACION_NOMINA',
  COMPROBANTE_CONTABLE = 'COMPROBANTE_CONTABLE',
  ANULACION_COMPROBANTE = 'ANULACION_COMPROBANTE',
}

@Entity('asientos_contables')
export class AsientoContable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  numero: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'enum', enum: TipoAsiento })
  tipo: TipoAsiento;

  @Column({ nullable: true })
  referencia: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @OneToMany(() => AsientoDetalle, detalle => detalle.asiento, { cascade: true })
  detalles: AsientoDetalle[];

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  totalDebito: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  totalCredito: number;

  @ManyToOne(() => User)
  createdBy: User;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
