import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "src/users/entities/user.entity";
import { AsientoDetalle } from "./asientos-detalles.entity";

export enum TipoAsiento {
    FACTURA_VENTA = 'factura_venta',
    FACTURA_ELECTRONICA = 'factura_electronica',
    GASTO = 'gasto',
    MANUAL = 'manual'
}

@Entity('asientos_contables')
export class AsientoContable {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    numero: string;

    @Column({ type: 'date' })
    fecha: Date;

    @Column({ type: 'enum', enum: TipoAsiento })
    tipo: TipoAsiento;

    @Column({ nullable: true })
    referencia: string;

    @Column({ type: 'text', nullable: true })
    descripcion: string;

    @OneToMany(() => AsientoDetalle, detalle => detalle.asiento, { cascade: true })
    detalles: AsientoDetalle[];

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalDebito: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalCredito: number;

    @ManyToOne(() => User)
    createdBy: User;

    @Column()
    createdById: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
