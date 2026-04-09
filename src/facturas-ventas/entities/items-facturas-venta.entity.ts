import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { FacturasVenta } from "./facturas-venta.entity";
import { Articulo } from "src/articulos/entities/articulos.entity";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";

@Entity('item_factura_venta')
export class ItemsFacturaVenta {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Articulo)
    // @JoinColumn({ name: 'productoId' })
    articulo: Articulo;

    @Column()
    articuloId: string;

    @Column('text')
    description: string;

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    unitPrice: number; // Precio unitario en ese momento

    @Column('decimal', { precision: 5, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    iva: number; // % impuesto IVA en ese momento

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    valor_iva: number; // Valor impuesto IVA en ese momento

    @Column('decimal', { precision: 5, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    discount: number; // % Descuento en ese momento

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    valor_discount: number; // % Descuento en ese momento

    @Column('decimal', { precision: 10, scale: 2, transformer: new ColumnNumericTransformer() })
    quantity: number; // Cantidad

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    subtotal: number; // unitPrice * quantity

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    importe: number; // subtotal * discount

    @Column('decimal', { precision: 15, scale: 2, transformer: new ColumnNumericTransformer() })
    total: number;

    // Relaciones
    @ManyToOne(() => FacturasVenta, invoice => invoice.items)
    @JoinColumn({ name: 'facturaId' })
    factura: FacturasVenta;

    @Column()
    facturaId: string;

    @CreateDateColumn()
    createdAt: Date;

}