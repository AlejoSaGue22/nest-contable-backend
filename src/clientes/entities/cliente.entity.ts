import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TipoDocumento } from "src/catalogs/entities/tipo-documento.entity";

@Entity({ name: 'clientes' })
export class Cliente {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    nombre: string;

    @Column()
    apellido: string;

    @Column()
    tipoDocumento: string;

    @ManyToOne(() => TipoDocumento)
    @JoinColumn({ name: 'tipoDocumento', referencedColumnName: 'codigo' })
    tipoDocumentoRel: TipoDocumento;


    @Column()
    numeroDocumento: string;

    @Column({ nullable: true })
    dv: string;  // Dígito de verificación (solo para NIT)  -- FALTA AGREGARLO EN EL FRONT

    @Column()
    tipoPersona: string;

    @Column({ nullable: true })
    razonSocial: string;

    @Column()
    direccion: string;

    @Column()
    ciudad: string;

    @Column()
    telefono: string;

    @Column()
    email: string;

    @Column()
    observacion: string;

    @Column()
    tributo: string;

    @Column()
    responsableFiscal: string;

    @Column('bool', { default: true })
    isActive: boolean;

    @DeleteDateColumn()
    deleteAt: Date;


}