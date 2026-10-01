import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { PeriodoNomina } from './periodo-nomina.entity';
import { Empleado } from './empleado.entity';
import { EstadoObligacionNomina } from '../enums/estado-obligacion-nomina.enum';

@Entity('obligaciones_nomina')
export class ObligacionNomina {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => PeriodoNomina)
    @JoinColumn({ name: 'periodoId' })
    periodo: PeriodoNomina;

    @Column()
    periodoId: string;

    @ManyToOne(() => Empleado)
    @JoinColumn({ name: 'empleadoId' })
    empleado: Empleado;

    @Column()
    empleadoId: string;

    @Column({ type: 'uuid', nullable: true })
    terceroId: string | null;

    @Column('decimal', { precision: 15, scale: 2 })
    valorOriginal: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    valorPagado: number;

    @Column('decimal', { precision: 15, scale: 2 })
    saldo: number;

    @Column({ type: 'enum', enum: EstadoObligacionNomina, default: EstadoObligacionNomina.PENDIENTE })
    estado: EstadoObligacionNomina;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

