import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';

@Entity('centros_costo')
export class CentroCosto {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Empresa, { nullable: true })
    @JoinColumn({ name: 'empresaId' })
    empresa: Empresa;

    @Column({ nullable: true })
    empresaId: string;

    @Column({ unique: true })
    codigo: string;

    @Column()
    nombre: string;

    @Column({ nullable: true })
    descripcion: string;

    @Column({ default: true })
    activo: boolean;
}
