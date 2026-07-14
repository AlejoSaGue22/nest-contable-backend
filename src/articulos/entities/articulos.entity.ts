import { CategoriaArticulo } from "src/core/catalogs/entities/categorias-articulos-entity";
import { UnidadMedida } from "src/core/catalogs/entities/unidad-medida.entity";
import { CuentaContable } from "src/cuentas/entities/cuenta.entity";
import { Impuesto } from "src/settings/impuestos/entities/impuesto.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum ArticuloTipo {
    VENTA = 'VENTA',
    GASTO = 'GASTO',
    COSTO = 'COSTO',
    SERVICIO = 'SERVICIO'
}

@Entity({ name: 'articulos' })
export class Articulo {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    codigo: string;

    @Column({ nullable: true, unique: true })
    nombre: string;

    @Column({ nullable: true })
    observacion: string;

    @Column({ type: 'enum', enum: ArticuloTipo })
    tipo: string;

    @Column()
    fullNameCategoria: string;

    @ManyToOne(() => CategoriaArticulo)
    @JoinColumn({ name: 'categoriaArticuloId', referencedColumnName: 'id' })
    categoriaArticulo: CategoriaArticulo;

    @Column()
    categoriaArticuloId: string;

    @ManyToOne(() => UnidadMedida)
    @JoinColumn({ name: 'unidadmedida', referencedColumnName: 'id' })
    unidadmedidaRel: UnidadMedida;

    @Column()
    unidadmedida: string;

    @ManyToOne(() => Impuesto, { eager: true })
    @JoinColumn({ name: 'impuestoId' })
    impuestoRel: Impuesto;

    @Column()
    impuestoId: string;

    @Column({ default: 0 }) // 0% por defecto -- RETENCION PENDIENTE SI SE AGREGA AL SISTEMA 
    retencion: number;

    @Column({ default: 0 })
    precio: number;

    @Column({ default: 0 })
    precioventa2: number;

    @Column({ default: true })
    isInventariable: boolean;

    @Column({ default: true })
    isActive: boolean;

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
