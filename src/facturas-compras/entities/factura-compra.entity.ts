import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Proveedor } from "../../proveedores/entities/proveedor.entity";
import { FacturaCompraDetalle } from "./factura-compra-detalle.entity";
import { User } from "src/users/entities/user.entity";

export enum GastoEstado {
    BORRADOR = 'borrador',
    ERROR_ASIENTO = 'error_asiento',
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

    @Column()
    formaPago: string;

    // @Column({ type: 'date', nullable: true })
    // fechaVencimiento: Date;

    @Column({ type: 'enum', enum: GastoEstado, default: GastoEstado.BORRADOR })
    estado: GastoEstado;

    @Column({ nullable: true })
    asientoError?: string;

    @Column({ nullable: true })
    fechaAsientoError?: Date;

    @OneToMany(() => FacturaCompraDetalle, detalle => detalle.facturaCompra, { cascade: true })
    items: FacturaCompraDetalle[];

    @Column('int')
    subtotal: number;

    @Column('int')
    descuento: number;

    @Column('int')
    iva: number;

    @Column('int')
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
