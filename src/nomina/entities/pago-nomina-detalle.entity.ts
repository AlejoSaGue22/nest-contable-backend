import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PagoNomina } from './pago-nomina.entity';
import { ObligacionNomina } from './obligacion-nomina.entity';

@Entity('pagos_nomina_detalle')
export class PagoNominaDetalle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => PagoNomina, pago => pago.detalles, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'pagoId' })
    pago: PagoNomina;

    @Column()
    pagoId: string;

    @ManyToOne(() => ObligacionNomina)
    @JoinColumn({ name: 'obligacionId' })
    obligacion: ObligacionNomina;

    @Column()
    obligacionId: string;

    @Column('decimal', { precision: 15, scale: 2 })
    valor: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    empleadoId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    terceroId: string | null;
}
