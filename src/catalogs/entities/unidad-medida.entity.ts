import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('unidades_medida')
export class UnidadMedida {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    codigo: string;

    @Column()
    nombre: string;
}
