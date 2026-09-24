import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  ManyToOne, 
  PrimaryGeneratedColumn,
  JoinColumn,
} from "typeorm";
import { NotaAjuste } from "./notas-ajuste.entity";
import { Articulo } from "src/articulos/entities/articulos.entity";
import { Impuesto } from "src/settings/impuestos/entities/impuesto.entity";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";

/**
 * Items de la nota de ajuste
 */
@Entity('items_nota_ajuste')
export class ItemNotaAjuste {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Articulo, { nullable: true })
  articulo: Articulo;

  @Column({ nullable: true })
  articuloId: string;

  @ManyToOne(() => Impuesto, { nullable: true })
  @JoinColumn({ name: 'impuestoId' })
  impuesto: Impuesto;

  @Column({ nullable: true })
  impuestoId: string;

  // ========== CAPA RESULTADO (valor acreditado por esta NC) ==========
  // cantidad/valorUnitario/subtotal/valorIVA/total + descuento/valorDescuento
  // son el RESULTADO calculado por el backend (fuente de verdad).

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  cantidad: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  valorUnitario: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  subtotal: number;

  @Column('int')
  porcentajeIVA: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  valorIVA: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  total: number;

  @Column('int')
  descuento: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  valorDescuento: number;

  // ========== CAPA 1: SNAPSHOT ORIGINAL (línea de la factura fuente) ==========
  // Congela el estado de la factura al crear la NC. Nunca lo escribe el usuario.

  @Column('decimal', { precision: 10, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  cantidadOriginal: number | null;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  precioOriginal: number | null;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  subtotalOriginal: number | null;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  valorDescuentoOriginal: number | null;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  valorIVAOriginal: number | null;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  totalOriginal: number | null;

  // ========== CAPA 2: INPUT DEL USUARIO (solo el dato del concepto) ==========
  // Devolución (1) → cantidadInput. Ajuste precio (4) → precioNuevo.
  // Descuento (3/5/6) → descuentoTasaInput o descuentoValorInput. Anulación (2) → nulls.

  @Column('decimal', { precision: 10, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  cantidadInput: number | null;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  precioNuevo: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  descuentoTasaInput: number | null;

  @Column('decimal', { precision: 15, scale: 2, nullable: true, transformer: new ColumnNumericTransformer() })
  descuentoValorInput: number | null;

  // ========== CAPA 4: IMPUESTOS / RETENCIONES (trazabilidad del cálculo) ==========

  @Column('json', { nullable: true })
  detalleCalculo: {
    base: number;
    tasaIva: number;
    iva: number;
    retenciones?: Array<{ codigo: string; tasa: number; valor: number }>;
    /** Datos extra por concepto (ej. ajuste precio: original/nuevo/diferencia). */
    info?: Record<string, number>;
  } | null;

  // Separación valor vs inventario: esta línea mueve inventario solo cuando
  // el módulo de inventarios exista. Hoy siempre false (no hay kardex).
  @Column({ type: 'boolean', default: false })
  afectaInventario: boolean;

  @ManyToOne(() => NotaAjuste, nota => nota.items)
  nota: NotaAjuste;

  @Column()
  notaId: string;

  @CreateDateColumn()
  createdAt: Date;
}