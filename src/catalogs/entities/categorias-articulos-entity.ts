import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('categorias_articulos')
export class CategoriaArticulo {
    @PrimaryGeneratedColumn()
    id: string;

    @Column()
    codigo: string;

    @Column()
    nombre: string;

    @Column()
    tipo: string;

    @Column()
    cuentaContableCodigo: string;

    @Column()
    cuentaIvaCodigo: string;

    @Column()
    descripcion: string;

    @Column('bool', { default: true })
    state: boolean;
}