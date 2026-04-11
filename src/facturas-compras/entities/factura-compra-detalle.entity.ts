import { Articulo } from "src/articulos/entities/articulos.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";
import { FacturaCompra } from "./factura-compra.entity";

@Entity('facturas_compras_detalles')
export class FacturaCompraDetalle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => FacturaCompra, facturaCompra => facturaCompra.items)
    facturaCompra: FacturaCompra;

    @Column()
    facturaCompraId: string;

    @ManyToOne(() => Articulo)
    articulo: Articulo;

    @Column()
    articuloId: string;

    @Column({ type: 'text', nullable: true })
    descripcion: string;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    unitPrice: number;

    @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
    quantity: number;

    @Column('decimal', { precision: 5, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    porcentajeIva: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    valorIva: number;

    @Column('decimal', { precision: 5, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    descuento: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    valorDescuento: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    valorSubtotal: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    itemTotal: number;

    @CreateDateColumn()
    createdAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;
}