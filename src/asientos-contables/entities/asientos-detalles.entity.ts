import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from "typeorm";
import { AsientoContable } from "./asientos-contable.entity";
import { CuentaContable } from "src/cuentas/entities/cuenta.entity";

@Entity('asientos_detalles')
export class AsientoDetalle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => AsientoContable, asiento => asiento.detalles)
    asiento: AsientoContable;

    @Column()
    asientoId: string;

    @ManyToOne(() => CuentaContable)
    cuenta: CuentaContable;

    @Column()
    cuentaId: string;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    debito: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    credito: number;

    @Column({ type: 'text', nullable: true })
    descripcion: string;

    @CreateDateColumn()
    createdAt: Date;
}