import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  ManyToOne, 
  PrimaryGeneratedColumn,
} from "typeorm";
import { NotaAjuste } from "./notas-ajuste.entity";
import { Articulo } from "src/articulos/entities/articulos.entity";
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

  @ManyToOne(() => NotaAjuste, nota => nota.items)
  nota: NotaAjuste;

  @Column()
  notaId: string;

  @CreateDateColumn()
  createdAt: Date;
}