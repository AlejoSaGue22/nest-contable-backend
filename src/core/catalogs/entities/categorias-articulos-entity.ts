import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { tipoCategoria } from 'src/common/constants/categorias-articulos.config';

@Entity('categorias_articulos')
export class CategoriaArticulo {
    @PrimaryGeneratedColumn()
    id: string;

    @Column()
    codigo: string;

    @Column()
    nombre: string;

    @Column()
    tipo: tipoCategoria;

    @ManyToOne(() => CuentaContable)
    @JoinColumn({ name: 'cuentaPrincipalId' })
    cuentaPrincipal: CuentaContable;

    @Column({ nullable: true })
    cuentaPrincipalId: string;

    @ManyToOne(() => CuentaContable, { nullable: true })
    @JoinColumn({ name: 'cuentaCostoId' })
    cuentaCosto: CuentaContable;

    @Column({ nullable: true })
    cuentaCostoId: string;

    @ManyToOne(() => CuentaContable, { nullable: true })
    @JoinColumn({ name: 'cuentaInventarioId' })
    cuentaInventario: CuentaContable;

    @Column({ nullable: true })
    cuentaInventarioId: string;

    @Column({ default: false })
    manejaInventario: boolean;

    @Column()
    descripcion: string;

    @Column('bool', { default: true })
    state: boolean;
}