import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TipoDocumento } from "src/core/catalogs/entities/tipo-documento.entity";
import { Municipality } from "src/core/municipalities/entities/municipality.entity";

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
    @JoinColumn({ name: 'tipoDocumento', referencedColumnName: 'id' })
    tipoDocumentoRel: TipoDocumento;

    @Column()
    numeroDocumento: string;

    @Column({ nullable: true })
    dv: string;  // Dígito de verificación (solo para NIT)  

    @Column()
    tipoPersona: string;

    @Column({ nullable: true })
    razonSocial: string;

    @Column()
    direccion: string;

    @ManyToOne(() => Municipality)
    @JoinColumn({ name: 'ciudad', referencedColumnName: 'id' })
    ciudadRel: Municipality;

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