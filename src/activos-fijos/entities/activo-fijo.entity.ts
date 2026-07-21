import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { CuentaContable } from '../../cuentas/entities/cuenta.entity';
import { Proveedor } from '../../proveedores/entities/proveedor.entity';
import { CentroCosto } from '../../nomina/entities/centro-costo.entity';
import { Empresa } from '../../settings/empresa/entities/empresa.entity';
import { ColumnNumericTransformer } from '../../common/transformers/column-numeric.transformer';

export enum EstadoActivo {
  ACTIVO = 'ACTIVO',
  DEPRECIADO = 'DEPRECIADO',
  RETIRADO = 'RETIRADO',
  VENDIDO = 'VENDIDO',
}

@Entity({ name: 'activos_fijos' })
export class ActivoFijo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @Column({ unique: true })
  codigo: string;

  @Column()
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ type: 'varchar', length: 100, default: 'Otros tangibles' })
  tipoActivo: string;

  @Column({ type: 'date' })
  fechaAdquisicion: Date;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  valorAdquisicion: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  valorSalvamento: number;

  @Column('int')
  vidaUtilMeses: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  depreciacionAcumulada: number;

  @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
  valorLibros: number;

  @Column({ type: 'enum', enum: EstadoActivo, default: EstadoActivo.ACTIVO })
  estado: EstadoActivo;

  // Cuentas contables obligatorias
  @ManyToOne(() => CuentaContable, { eager: true })
  @JoinColumn({ name: 'cuentaActivoId' })
  cuentaActivo: CuentaContable;

  @Column()
  cuentaActivoId: string;

  @ManyToOne(() => CuentaContable, { eager: true })
  @JoinColumn({ name: 'cuentaDepreciacionAcumuladaId' })
  cuentaDepreciacionAcumulada: CuentaContable;

  @Column()
  cuentaDepreciacionAcumuladaId: string;

  @ManyToOne(() => CuentaContable, { eager: true })
  @JoinColumn({ name: 'cuentaGastoDepreciacionId' })
  cuentaGastoDepreciacion: CuentaContable;

  @Column()
  cuentaGastoDepreciacionId: string;

  // Relaciones analíticas adicionales (opcionales)
  @ManyToOne(() => Proveedor, { nullable: true })
  @JoinColumn({ name: 'proveedorId' })
  proveedor: Proveedor;

  @Column({ nullable: true })
  proveedorId: string;

  @ManyToOne(() => CentroCosto, { nullable: true })
  @JoinColumn({ name: 'centroCostoId' })
  centroCosto: CentroCosto;

  @Column({ nullable: true })
  centroCostoId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deleteAt: Date;
}
