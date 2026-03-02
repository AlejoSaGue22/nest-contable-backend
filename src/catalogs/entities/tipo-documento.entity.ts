import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tipos_documento')
export class TipoDocumento {
    @PrimaryGeneratedColumn()
    id: string;

    @Column()
    abreviatura: string;

    @Column()
    nombre: string;

    @Column('boolean', { default: true })
    state: boolean;
}
