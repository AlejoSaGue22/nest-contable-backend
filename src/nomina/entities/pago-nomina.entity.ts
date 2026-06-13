import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { PeriodoNomina } from './periodo-nomina.entity';
import { User } from 'src/users/entities/user.entity';
import { Banco } from 'src/bancos/entities/banco.entity';

@Entity('pagos_nomina')
export class PagoNomina {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => PeriodoNomina)
    @JoinColumn({ name: 'periodoId' })
    periodo: PeriodoNomina;

    @Column()
    periodoId: string;

    @Column({ type: 'date' })
    fechaPago: Date;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    valor: number;

    @Column({ length: 10 })
    cuentaCodigoContable: string;

    @ManyToOne(() => Banco)
    @JoinColumn({ name: 'bancoId' })
    banco: Banco;

    @Column({ nullable: true })
    bancoId: string | null;

    @Column({ nullable: true })
    numeroComprobante: string | null;

    @Column({ type: 'text', nullable: true })
    observaciones: string | null;

    @Column()
    asientoPagoId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'createdById' })
    createdBy: User;

    @Column({ nullable: true })
    createdById: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
