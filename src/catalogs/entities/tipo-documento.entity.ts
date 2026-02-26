import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tipos_documento')
export class TipoDocumento {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    codigo: string;

    @Column()
    nombre: string;
}
