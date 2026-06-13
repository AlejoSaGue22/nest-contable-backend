import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum TipoEntidadSS {
    EPS = 'EPS',
    AFP = 'AFP',
    CCF = 'CCF'
}

@Entity('entidades_seguridad_social')
export class EntidadSeguridadSocial {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    codigo: string;

    @Column()
    nombre: string;

    @Column({ type: 'enum', enum: TipoEntidadSS })
    tipo: TipoEntidadSS;

    @Column({ default: true })
    activo: boolean;
}
