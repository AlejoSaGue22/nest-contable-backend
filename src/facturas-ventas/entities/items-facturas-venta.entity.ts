import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { FacturasVenta } from "./facturas-venta.entity";
import { Producto } from "src/productos/entities/producto.entity";

@Entity('item_factura_venta')
export class ItemsFacturaVenta {

    @PrimaryGeneratedColumn()
    id: string;

    @ManyToOne(()=> Producto)
    producto: Producto;

    @Column()
    productoId: string;

    @Column('text')
    description: string;

    @Column('int')
    unitPrice: number; // Precio unitario en ese momento

    @Column('int')
    iva: number; // % impuesto IVA en ese momento

    @Column('int')
    valor_iva: number; // Valor impuesto IVA en ese momento

    @Column('int')
    discount: number; // % Descuento en ese momento

    @Column('int')
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