import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('categorias_articulos')
export class CategoriaArticulo {
    @PrimaryGeneratedColumn()
    id: number;

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
}