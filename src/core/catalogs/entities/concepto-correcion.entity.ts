import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity('concepto_correccion')
@Unique(['codigo', 'tipo'])
export class ConceptoCorreccion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    codigo: string;

    @Column({ type: 'varchar', length: 255 })
    nombre: string;

    @Column({ type: 'varchar', length: 10, default: 'credito' })
    tipo: string; // 'credito' | 'debito'

    @Column({ type: 'boolean', default: true })
    state: boolean;

}