import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { ColumnNumericTransformer } from 'src/common/transformers/column-numeric.transformer';

export enum TipoMovimientoInventario {
  ENTRADA = 'entrada',
  SALIDA = 'salida',
  AJUSTE = 'ajuste',
}

export enum DocumentoInventario {
  FACTURA_VENTA = 'factura_venta',
  FACTURA_COMPRA = 'factura_compra',
  DOCUMENTO_SOPORTE = 'documento_soporte',
  NOTA_CREDITO = 'nota_credito',
  NOTA_CREDITO_COMPRA = 'nota_credito_compra',
  NOTA_CREDITO_SOPORTE = 'nota_credito_soporte',
  AJUSTE_MANUAL = 'ajuste_manual',
}

/**
 * Kardex mínimo (v1): cada movimiento deja saldo resultante.
 * El stock vivo está en articulos.stock; esta tabla es la auditoría.
 * Idempotencia: un documento genera movimientos una sola vez
 * (se verifica por documentoTipo + documentoId antes de registrar).
 */
@Entity('movimientos_inventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Articulo, { nullable: true })
  @JoinColumn({ name: 'articuloId' })
  articulo: Articulo;

  @Column()
  articuloId: string;

  /**
   * Base multi-empresa: el movimiento hereda la empresa del artículo.
   * Nullable para no romper el kardex histórico existente.
   */
  @Index('IDX_mov_inv_empresa')
  @Column({ type: 'uuid', nullable: true })
  empresaId: string | null;

  @Column({ type: 'enum', enum: TipoMovimientoInventario })
  tipo: TipoMovimientoInventario;

  @Column('decimal', { precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  cantidad: number;

  @Column({ type: 'enum', enum: DocumentoInventario })
  documentoTipo: DocumentoInventario;

  @Column()
  documentoId: string;

  @Column('decimal', { precision: 12, scale: 2, transformer: new ColumnNumericTransformer() })
  saldoDespues: number;

  @Column({ type: 'text', nullable: true })
  motivo: string | null;

  @Column()
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;
}
