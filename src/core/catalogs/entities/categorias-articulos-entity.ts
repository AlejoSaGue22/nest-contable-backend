import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

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

    @ManyToOne(() => CuentaContable)
    @JoinColumn({ name: 'cuentaContableCodigo', referencedColumnName: 'codigo' })
    cuentaContable: CuentaContable;

    @ManyToOne(() => CuentaContable)
    @JoinColumn({ name: 'cuentaIvaCodigo', referencedColumnName: 'codigo' })
    cuentaIva: CuentaContable;

    @Column()
    cuentaIvaCodigo: string;

    @Column()
    descripcion: string;

    @Column('bool', { default: true })
    state: boolean;
}