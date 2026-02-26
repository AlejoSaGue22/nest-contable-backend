import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('metodos_pago')
export class MetodoPago {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    codigo: string;

    @Column()
    nombre: string;
}
