import { TipoDocumento } from "src/core/catalogs/entities/tipo-documento.entity";
import { Municipality } from "src/core/municipalities/entities/municipality.entity";
import { CuentaContable } from "src/cuentas/entities/cuenta.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('proveedores')
export class Proveedor {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    dv?: string;

    @Column()
    tipoPersona: string;

    @Column({ nullable: true })
    razonSocial?: string;

    @ManyToOne(() => TipoDocumento)
    @JoinColumn({ name: 'tipoDocumento', referencedColumnName: 'id' })
    tipoDocumentoRel: TipoDocumento;

    @Column()
    tipoDocumento: number;

    @Column()
    identificacion: string;

    @Column({ nullable: true })
    nombre?: string;

    @Column({ nullable: true })
    apellido?: string;

    @Column()
    email: string;

    @Column()
    telefono: string;

    @Column({ nullable: true })
    direccion: string;

    @ManyToOne(() => Municipality)
    @JoinColumn({ name: 'ciudad', referencedColumnName: 'id' })
    ciudadRel: Municipality;

    @Column({ nullable: true})
    ciudad: number;

    @Column({ nullable: true })
    nombreContacto: string;

    @Column({ nullable: true })
    telefonoContacto: string;

    @Column({ nullable: true })
    observaciones: string;

    @ManyToOne(() => CuentaContable, { nullable: true })
    @JoinColumn({ name: 'cuentaContableId' })
    cuentaContable: CuentaContable;

    @Column({ nullable: true })
    cuentaContableId: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;
}
