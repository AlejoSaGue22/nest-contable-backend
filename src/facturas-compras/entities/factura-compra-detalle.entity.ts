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

    @Column('decimal', { precision: 15, scale: 2 })
    valor: number;

    @Column('decimal', { precision: 5, scale: 2, default: 0 })
    porcentajeIva: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    valorIva: number;

    @CreateDateColumn()
    createdAt: Date;
}