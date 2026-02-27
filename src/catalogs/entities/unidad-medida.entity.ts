import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('unidades_medida')
export class UnidadMedida {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({unique: true})
    codigo: string;

    @Column()
    nombre: string;
}
