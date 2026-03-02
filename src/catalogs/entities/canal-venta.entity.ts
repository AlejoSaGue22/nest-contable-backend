import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('canales_venta')
export class CanalVenta {
    @PrimaryGeneratedColumn()
    id: string;

    @Column()
    codigo: string;

    @Column()
    nombre: string;

    @Column('bool', { default: true })
    state: boolean;
}
