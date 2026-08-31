import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { PeriodoNomina } from './periodo-nomina.entity';
import { Empleado } from './empleado.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { ComprobanteContable } from 'src/comprobantes/entities/comprobante-contable.entity';

@Entity('liquidaciones_nomina')
export class Liquidacion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Empresa, { nullable: true })
    @JoinColumn({ name: 'empresaId' })
    empresa: Empresa;

    @Column({ nullable: true })
    empresaId: string;

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

    @Column({ default: 30 })
    diasTrabajados: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    salarioDevengado: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    auxilioTransporte: number;

    @Column('json', { nullable: true })
    horasExtras: { tipo: string; cantidad: number; valor: number }[];

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalHorasExtras: number;

    @Column('json', { nullable: true })
    bonificaciones: { concepto: string; valor: number; salarial: boolean }[];

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalBonificaciones: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    comisiones: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalDevengado: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    saludEmpleado: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    pensionEmpleado: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    retencionFuente: number;

    @Column('json', { nullable: true })
    otrasDeducciones: { concepto: string; valor: number }[];

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalDeducciones: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    netoPagar: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    ibc: number;

    @Column('json', { nullable: true })
    aportesEmpleador: { concepto: string; valor: number }[];

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalAportes: number;

    @Column('json', { nullable: true })
    provisiones: { concepto: string; valor: number }[];

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalProvisiones: number;

    @ManyToOne(() => ComprobanteContable)
    @JoinColumn({ name: 'comprobanteId' })
    comprobante: ComprobanteContable;

    @Column({ nullable: true })
    comprobanteId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
