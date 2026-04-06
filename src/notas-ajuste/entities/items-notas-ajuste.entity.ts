import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  ManyToOne, 
  PrimaryGeneratedColumn,
} from "typeorm";
import { NotaAjuste } from "./notas-ajuste.entity";
import { Articulo } from "src/articulos/entities/articulos.entity";

/**
 * Items de la nota de ajuste
 */
@Entity('items_nota_ajuste')
export class ItemNotaAjuste {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  cantidad: number;

  @Column('decimal', { precision: 10, scale: 2 })
  valorUnitario: number;

  @Column('decimal', { precision: 5, scale: 2 })
  porcentajeIVA: number;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2 })
  valorIVA: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @ManyToOne(() => Articulo, { nullable: true })
  articulo: Articulo;

  @Column({ nullable: true })
  articuloId: string;

  @ManyToOne(() => NotaAjuste, nota => nota.items)
  nota: NotaAjuste;

  @Column()
  notaId: string;

  @CreateDateColumn()
  createdAt: Date;
}