import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum TipoCuenta {
    ACTIVO = 'ACTIVO',
    PASIVO = 'PASIVO',
    PATRIMONIO = 'PATRIMONIO',
    INGRESO = 'INGRESO',
    GASTO = 'GASTO',
    COSTO = 'COSTO',
}

export enum NaturalezaCuenta {
    DEBITO = 'DEBITO',
    CREDITO = 'CREDITO',
}

@Entity({ name: 'cuentas_contables' })
export class CuentaContable {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    codigo: string;

    @Column()
    nombre: string;

    @Column({ nullable: true })
    descripcion: string;

    @Column({ type: 'enum', enum: TipoCuenta })
    tipo: string;

    @Column({ type: 'enum', enum: NaturalezaCuenta })
    naturaleza: string;

    @Column()
    nivel: number;

    @ManyToOne(() => CuentaContable, { nullable: true })
    cuentaPadre: CuentaContable;

    @Column({ nullable: true })
    cuentaPadreId: string;

    @Column({ default: true })
    aceptaMovimiento: boolean;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isSystemAccount: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @DeleteDateColumn()
    deleteAt: Date;
}
