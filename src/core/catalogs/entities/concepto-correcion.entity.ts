import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('concepto_correccion')
export class ConceptoCorreccion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10, unique: true })
    codigo: string;

    @Column({ type: 'varchar', length: 255 })
    nombre: string;

    @Column({ type: 'boolean', default: true })
    state: boolean;

}