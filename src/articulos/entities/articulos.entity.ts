import { CuentaContable } from "src/cuentas/entities/cuenta.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum ArticuloTipo {
    VENTA = 'venta',
    GASTO = 'gasto',
    COMPRA = 'compra',
    INVENTARIO = 'inventario'
}

@Entity({ name: 'articulos' })
export class Articulo {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    codigo: string;

    @Column({ nullable: true, unique: true })
    nombre: string;

    @Column()
    observacion: string;

    @Column({ type: 'enum', enum: ArticuloTipo })
    tipo: string;

    @Column()
    tipoCodigo: string;

    @Column()
    fullNameTipo: string;

    @Column()
    unidadmedida: string;

    @Column()
    impuesto: number;

    @Column({ default: 0 }) // 0% por defecto -- RETENCION PENDIENTE SI SE AGREGA AL SISTEMA
    retencion: number;

    @Column({ default: 0 })
    precio: number;

    @Column({ default: 0 })
    precioventa2: number;

    @Column({ default: true })
    afectaInventario: boolean;

    @Column({ default: true })
    isActive: boolean;

    @ManyToOne(() => CuentaContable)
    cuentaContable: CuentaContable;

    @Column()
    cuentaContableId: string;

    @ManyToOne(() => CuentaContable, { nullable: true })
    cuentaIva: CuentaContable;

    @Column({ nullable: true })
    cuentaIvaId: string;

    @Column('int', { default: 0 })
    porcentajeIva: number;

    @CreateDateColumn()
    createdAt: Date;

    @Column()
    createdById: string;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deleteAt: Date;
}
