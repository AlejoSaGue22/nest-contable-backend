import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { FacturasVenta } from "./facturas-venta.entity";
import { Articulo } from "src/articulos/entities/articulos.entity";

@Entity('item_factura_venta')
export class ItemsFacturaVenta {

    @PrimaryGeneratedColumn()
    id: string;

    @ManyToOne(() => Articulo)
    // @JoinColumn({ name: 'productoId' })
    articulo: Articulo;

    @Column()
    articuloId: string;

    @Column('text')
    description: string;

    @Column('int')
    unitPrice: number; // Precio unitario en ese momento

    @Column('int', { default: 0 })
    iva: number; // % impuesto IVA en ese momento

    @Column('int', { default: 0 })
    valor_iva: number; // Valor impuesto IVA en ese momento

    @Column('int', { default: 0 })
    discount: number; // % Descuento en ese momento

    @Column('int', { default: 0 })
    valor_discount: number; // % Descuento en ese momento

    @Column('int')
    quantity: number; // Cantidad

    @Column('int')
    subtotal: number; // unitPrice * quantity

    @Column('int')
    importe: number; // subtotal * discount

    @Column('int')
    total: number;

    // Relaciones
    @ManyToOne(() => FacturasVenta, invoice => invoice.items)
    factura: FacturasVenta;

    @Column()
    facturaId: string;

    @CreateDateColumn()
    createdAt: Date;

}