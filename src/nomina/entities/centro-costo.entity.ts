import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('centros_costo')
export class CentroCosto {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    codigo: string;

    @Column()
    nombre: string;

    @Column({ nullable: true })
    descripcion: string;

    @Column({ default: true })
    activo: boolean;
}
