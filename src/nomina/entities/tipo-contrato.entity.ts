import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tipos_contrato')
export class TipoContratoEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    codigo: string;

    @Column()
    nombre: string;

    @Column({ default: true })
    activo: boolean;
}
