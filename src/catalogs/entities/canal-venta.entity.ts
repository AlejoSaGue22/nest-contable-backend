import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('canales_venta')
export class CanalVenta {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    codigo: string;

    @Column()
    nombre: string;
}
