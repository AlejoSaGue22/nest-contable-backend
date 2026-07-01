import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('parametrizacion_contable')
export class ParametrizacionContable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Cuenta por cobrar clientes
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaCobrarClientesId' })
  cuentaCobrarClientes: CuentaContable;

  @Column({ nullable: true })
  cuentaCobrarClientesId: string;

  // Devoluciones de clientes
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaDevolucionesClientesId' })
  cuentaDevolucionesClientes: CuentaContable;

  @Column({ nullable: true })
  cuentaDevolucionesClientesId: string;

  // Cuentas de proveedores
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaPagarProveedoresId' })
  cuentaPagarProveedores: CuentaContable;

  @Column({ nullable: true })
  cuentaPagarProveedoresId: string;

  // Devoluciones de proveedores
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaDevolucionesProveedoresId' })
  cuentaDevolucionesProveedores: CuentaContable;

  @Column({ nullable: true })
  cuentaDevolucionesProveedoresId: string;

  // Devolución del IVA en compras
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaDevolucionIvaComprasId' })
  cuentaDevolucionIvaCompras: CuentaContable;

  @Column({ nullable: true })
  cuentaDevolucionIvaComprasId: string;

  // Cuenta de Caja por defecto
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaCajaDefectoId' })
  cuentaCajaDefecto: CuentaContable;

  @Column({ nullable: true })
  cuentaCajaDefectoId: string;

  // Cuenta de Bancos por defecto
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaBancosDefectoId' })
  cuentaBancosDefecto: CuentaContable;

  @Column({ nullable: true })
  cuentaBancosDefectoId: string;

  // Cuenta de CxP Gastos (Costos y gastos por pagar)
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaPagarGastosId' })
  cuentaPagarGastos: CuentaContable;

  @Column({ nullable: true })
  cuentaPagarGastosId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
