import { Column, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

export enum TipoCuenta {
    ACTIVO = 'ACTIVO',
    PASIVO = 'PASIVO',
    INGRESO = 'INGRESO',
    GASTO = 'GASTO',
    COSTO = 'COSTO',
    PATRIMONIO = 'PATRIMONIO'
}

export enum NaturalezaCuenta {
    DEBITO = 'DEBITO',
    CREDITO = 'CREDITO',
}

@Entity({ name: 'cuentas_contables' })
export class CuentaContable {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
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

    @DeleteDateColumn()
    deleteAt: Date;
}
