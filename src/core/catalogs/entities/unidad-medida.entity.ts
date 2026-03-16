import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('unidades_medida')
export class UnidadMedida {
    @PrimaryGeneratedColumn()
    id: string;

    @Column({ unique: true })
    codigo: string;

    @Column()
    nombre: string;

    @Column('bool', { default: true })
    state: boolean;
}
