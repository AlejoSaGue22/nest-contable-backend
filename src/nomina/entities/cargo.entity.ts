import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cargos')
export class Cargo {
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
