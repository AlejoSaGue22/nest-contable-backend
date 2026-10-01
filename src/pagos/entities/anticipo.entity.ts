import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Pago } from './pago.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { AnticipoEstado, AnticipoTipo } from '../enums/pago.enum';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';

@Entity('anticipos')
export class Anticipo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @Column({ type: 'varchar', length: 30 })
  numero: string;

  @Column({ type: 'enum', enum: AnticipoTipo })
  tipo: AnticipoTipo;

  @ManyToOne(() => Cliente, { nullable: true })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @Column({ nullable: true })
  clienteId: string | null;

  @ManyToOne(() => Proveedor, { nullable: true })
  @JoinColumn({ name: 'proveedorId' })
  proveedor: Proveedor;

  @Column({ nullable: true })
  proveedorId: string | null;

  @Column({ type: 'date' })
  fecha: Date;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  montoOriginal: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  saldoDisponible: number;

  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaContableId' })
  cuentaContable: CuentaContable;

  @Column({ nullable: true })
  cuentaContableId: string | null;

  @ManyToOne(() => Pago, { nullable: true })
  @JoinColumn({ name: 'pagoId' })
  pago: Pago;

  @Column({ nullable: true })
  pagoId: string | null;

  @Column({ type: 'enum', enum: AnticipoEstado, default: AnticipoEstado.PENDIENTE })
  estado: AnticipoEstado;

  @CreateDateColumn()
  createdAt: Date;
}
