import { Articulo } from "src/articulos/entities/articulos.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
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

    @Column('int')
    unitPrice: number;

    @Column('int')
    quantity: number;

    @Column('int', { default: 0 })
    porcentajeIva: number;

    @Column('int', { default: 0 })
    valorIva: number;

    @Column('int', { default: 0 })
    descuento: number;

    @Column('int', { default: 0 })
    valorDescuento: number;

    @Column('int', { default: 0 })
    valorSubtotal: number;

    @Column('int', { default: 0 })
    itemTotal: number;

    @CreateDateColumn()
    createdAt: Date;
}