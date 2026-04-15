import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('metodos_pago')
export class MetodoPago {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    codigo: string;

    @Column()
    nombre: string;

    @Column('bool', { default: true })
    state: boolean;
}
