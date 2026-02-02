import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('proveedores')
export class Proveedor {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    tipoDocumento: string;

    @Column()
    identificacion: string;

    @Column()
    nombre: string;

    @Column()
    email: string;

    @Column()
    telefono: string;

    @Column({ nullable: true })
    direccion: string;

    @Column({ nullable: true })
    ciudad: string;

    @Column({ nullable: true })
    nombreContacto: string;

    @Column({ nullable: true })
    telefonoContacto: string;

    @Column({ nullable: true })
    observaciones: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;
}
