import { Column, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'productos' })
export class Producto {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    categoria: string;

    @Column({ nullable: true, unique: true })
    nombre: string;

    @Column('text')
    codigo: string;

    @Column()
    unidadmedida: string;

    @Column()
    impuesto: string;

    @Column()
    retencion: string;

    @Column()
    precioventa1: string;

    @Column()
    precioventa2: string;

    @Column('bool', { default: true })
    isActive: boolean;

    @Column()
    observacion: string;

    @DeleteDateColumn()
    deleteAt: Date;
}
