import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  ManyToOne, 
  PrimaryGeneratedColumn,
} from "typeorm";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";
import { Articulo } from "src/articulos/entities/articulos.entity";
import { NotaAjusteCompra } from "./notas-ajuste-compra.entity";

@Entity('items_nota_ajuste_compra')
export class ItemNotaAjusteCompra {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Articulo, { nullable: true })
  articulo: Articulo;

  @Column({ nullable: true })
  articuloId: string;

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
