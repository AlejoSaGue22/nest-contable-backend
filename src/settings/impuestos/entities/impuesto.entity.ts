import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('impuestos')
export class Impuesto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @Column()
  nombre: string;

  @Column()
  tipo: string; // IVA, Retención, etc.

  @Column('decimal', { precision: 10, scale: 2 })
  tarifa: number;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ default: true })
  activo: boolean;

  // Cuentas contables para el mapeo automático
  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaVentasId' })
  cuentaVentas: CuentaContable;

  @Column({ nullable: true })
  cuentaVentasId: string;

  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaComprasId' })
  cuentaCompras: CuentaContable;

  @Column({ nullable: true })
  cuentaComprasId: string;

  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaDevVentasId' })
  cuentaDevVentas: CuentaContable;

  @Column({ nullable: true })
  cuentaDevVentasId: string;

  @ManyToOne(() => CuentaContable, { nullable: true })
  @JoinColumn({ name: 'cuentaDevComprasId' })
  cuentaDevCompras: CuentaContable;

  @Column({ nullable: true })
  cuentaDevComprasId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
