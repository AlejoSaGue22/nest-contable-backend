import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Banco } from '../../bancos/entities/banco.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';

export enum TipoCuentaBancaria {
  CORRIENTE = 'corriente',
  AHORRO    = 'ahorro',
}

/**
 * Cuentas bancarias de la empresa.
 * Cuando se registra un pago en banco, se referencia esta entidad
 * para saber exactamente a qué banco/cuenta ingresó o salió el dinero.
 */
@Entity('cuentas_bancarias')
export class CuentasBancarias {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nombre descriptivo: "Bancolombia Cta. Corriente" */
  @Column({ length: 120 })
  nombre: string;

  @ManyToOne(() => Banco, { eager: true })
  @JoinColumn({ name: 'bancoId' })
  banco: Banco;

  @Column({ type: 'enum', enum: TipoCuentaBancaria })
  tipoCuenta: TipoCuentaBancaria;

  /** Número de cuenta (se guarda enmascarado si se desea) */
  @Column({ length: 30, nullable: true })
  numeroCuenta: string;

  /**
   * Código de la cuenta contable asociada.
   * Normalmente '1110' (Bancos) — pero podría ser una subcuenta
   * si manejan varios bancos con cuentas distintas.
   */
  @Column({ length: 10, default: '1110' })
  codigoCuentaContable: string;

  @Column({ default: true })
  activa: boolean;

  @Column({ default: 0, type: 'decimal', precision: 18, scale: 2, transformer: new ColumnNumericTransformer() })
  saldoInicial: number;

  @Column({ default: 0, type: 'decimal', precision: 18, scale: 2, transformer: new ColumnNumericTransformer() })
  saldoActual: number;

  @Column({ nullable: true })
  observaciones: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}