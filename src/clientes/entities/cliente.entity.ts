import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { TipoDocumento } from "src/core/catalogs/entities/tipo-documento.entity";
import { Municipality } from "src/core/municipalities/entities/municipality.entity";
import { CuentaContable } from "src/cuentas/entities/cuenta.entity";

@Entity({ name: 'clientes' })
export class Cliente {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    nombre: string;

    @Column()
    apellido: string;

    @Column()
    tipoDocumento: number;

    @ManyToOne(() => TipoDocumento, { eager: true })
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
    ciudad: number;

    @Column()
    telefono: string;

    @Column()
    email: string;

    @Column()
    observacion: string;

    @Column({ comment: 'Indica si el cliente es responsable de IVA S=Si, N=No' })
    tributo: string;

    @ManyToOne(() => CuentaContable, { nullable: true })
    @JoinColumn({ name: 'cuentaContableId' })
    cuentaContable: CuentaContable;

    @Column({ nullable: true })
    cuentaContableId: string;

    @Column('bool', { default: true })
    isActive: boolean;

    @DeleteDateColumn()
    deleteAt: Date;


}