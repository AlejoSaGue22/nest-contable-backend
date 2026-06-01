import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  ManyToOne, 
  PrimaryGeneratedColumn,
  JoinColumn,
} from "typeorm";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";
import { Articulo } from "src/articulos/entities/articulos.entity";
import { Impuesto } from "src/settings/impuestos/entities/impuesto.entity";
import { NotaAjusteCompra } from "./notas-ajuste-compra.entity";

@Entity('items_nota_ajuste_compra')
export class ItemNotaAjusteCompra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Articulo, { nullable: true, eager: true })
  articulo: Articulo;

  @Column({ nullable: true })
  articuloId: string;

  @ManyToOne(() => Impuesto, { nullable: true })
  @JoinColumn({ name: 'impuestoId' })
  impuesto: Impuesto;

  @Column({ nullable: true })
  impuestoId: string;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  cantidad: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  valorUnitario: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  subtotal: number;

  @Column('int', { default: 0 })
  porcentajeIVA: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer(), default: 0 })
  valorIVA: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
  total: number;

  @Column('int', { default: 0 })
  descuento: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer(), default: 0 })
  valorDescuento: number;

  @ManyToOne(() => NotaAjusteCompra, nota => nota.items, { onDelete: 'CASCADE' })
  nota: NotaAjusteCompra;

  @Column()
  notaId: string;

  @CreateDateColumn()
  createdAt: Date;
}
