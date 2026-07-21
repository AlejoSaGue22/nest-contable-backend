import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { TipoPeriodoNomina } from '../enums/tipo-periodo.enum';
import { EstadoPeriodoNomina } from '../enums/estado-periodo.enum';
import { EstadoDianNomina } from '../enums/estado-dian-nomina.enum';
import { User } from 'src/users/entities/user.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';

@Entity('periodos_nomina')
export class PeriodoNomina {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Empresa, { nullable: true })
    @JoinColumn({ name: 'empresaId' })
    empresa: Empresa;

    @Column({ nullable: true })
    empresaId: string;

    @Column()
    nombre: string;

    @Column({ type: 'date' })
    fechaInicio: Date;

    @Column({ type: 'date' })
    fechaFin: Date;

    @Column({ type: 'enum', enum: TipoPeriodoNomina })
    tipo: TipoPeriodoNomina;

    @Column({ type: 'enum', enum: EstadoPeriodoNomina, default: EstadoPeriodoNomina.BORRADOR })
    estado: EstadoPeriodoNomina;

    @Column({ type: 'date', nullable: true })
    fechaPago: Date;

    @Column({ nullable: true })
    asientoProvisionId: string;

    @Column({ nullable: true })
    asientoPagoId: string;

    @Column({ type: 'enum', enum: EstadoDianNomina, default: EstadoDianNomina.NO_ENVIADA })
    dianEstado: EstadoDianNomina;

    @Column({ nullable: true })
    dianCune: string;

    @Column({ type: 'text', nullable: true })
    dianXml: string;

    @Column({ type: 'json', nullable: true })
    dianResponse: any;

    @Column({ nullable: true })
    dianNumero: string;

    @Column({ nullable: true })
    dianQrUrl: string;

    @Column({ type: 'timestamp', nullable: true })
    dianFechaEnvio: Date;

    @Column({ type: 'timestamp', nullable: true })
    dianFechaAceptacion: Date;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalDevengado: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalDeducciones: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalNeto: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalCostoEmpresa: number;

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
