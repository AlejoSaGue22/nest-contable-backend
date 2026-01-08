import { Column, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'clientes'})
export class Cliente {
    
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    nombre: string;

    @Column()
    apellido: string;

    @Column()
    tipoDocumento: string;

    @Column()
    numeroDocumento: string;

    @Column()
    tipoPersona: string;

    @Column({ nullable: true})
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
    responsableFiscal: string;

    @Column('bool', { default: true })
    isActive: boolean;

    @DeleteDateColumn()
    deleteAt: Date;


}