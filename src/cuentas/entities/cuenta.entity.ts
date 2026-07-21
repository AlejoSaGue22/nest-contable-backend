import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Empresa } from "src/settings/empresa/entities/empresa.entity";

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

    @Column({ default: false })
    requiereTercero: boolean;

    @Column({ default: false })
    requiereCentroCostos: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @DeleteDateColumn()
    deleteAt: Date;
}
