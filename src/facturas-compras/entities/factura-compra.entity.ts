import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Proveedor } from "../../proveedores/entities/proveedor.entity";
import { FacturaCompraDetalle } from "./factura-compra-detalle.entity";
import { User } from "src/users/entities/user.entity";

export enum GastoEstado {
    BORRADOR = 'borrador',
    REGISTRADO = 'registrado',
    PAGADO = 'pagado',
    ANULADO = 'anulado'
}

@Entity('facturas_compras')
export class FacturaCompra {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    numero: string;

    @Column({ type: 'date' })
    fecha: Date;

    @ManyToOne(() => Proveedor)
    proveedor: Proveedor;

    @Column()
    proveedorId: string;

    @Column({ nullable: true })
    observaciones: string;

    @Column({ type: 'enum', enum: GastoEstado, default: GastoEstado.BORRADOR })
    estado: GastoEstado;

    @OneToMany(() => FacturaCompraDetalle, detalle => detalle.facturaCompra, { cascade: true })
    items: FacturaCompraDetalle[];

    @Column('decimal', { precision: 15, scale: 2 })
    subtotal: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    iva: number;

    @Column('decimal', { precision: 15, scale: 2 })
    total: number;

    @Column({ nullable: true })
    numeroFacturaProveedor: string;

    @ManyToOne(() => User)
    createdBy: User;

    @Column()
    createdById: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
