import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, JoinColumn } from "typeorm";
import { AsientoContable } from "./asientos-contable.entity";
import { CuentaContable } from "src/cuentas/entities/cuenta.entity";
import { Cliente } from "src/clientes/entities/cliente.entity";
import { Proveedor } from "src/proveedores/entities/proveedor.entity";
import { CentroCosto } from "src/nomina/entities/centro-costo.entity";
import { EntidadSeguridadSocial } from "src/nomina/entities/entidad-seguridad-social.entity";
import { Impuesto } from "src/settings/impuestos/entities/impuesto.entity";
import { ColumnNumericTransformer } from "src/common/transformers/column-numeric.transformer";

@Entity('asientos_detalles')
export class AsientoDetalle {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => AsientoContable, asiento => asiento.detalles, { onDelete: 'CASCADE' })
    asiento: AsientoContable;

    @Column()
    asientoId: string;

    @ManyToOne(() => CuentaContable)
    cuenta: CuentaContable;

    @Column()
    cuentaId: string;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    debito: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    credito: number;

    @Column({ type: 'text', nullable: true })
    descripcion: string;

    // --- Campos analíticos y de auditoría tributaria colombiana ---
    @ManyToOne(() => Cliente, { nullable: true })
    @JoinColumn({ name: 'clienteId' })
    cliente: Cliente;

    @Column({ nullable: true })
    clienteId: string;

    @ManyToOne(() => Proveedor, { nullable: true })
    @JoinColumn({ name: 'proveedorId' })
    proveedor: Proveedor;

    @Column({ nullable: true })
    proveedorId: string;

    @ManyToOne(() => EntidadSeguridadSocial, { nullable: true })
    @JoinColumn({ name: 'entidadSSId' })
    entidadSS: EntidadSeguridadSocial;

    @Column({ nullable: true })
    entidadSSId: string;

    @ManyToOne(() => CentroCosto, { nullable: true })
    @JoinColumn({ name: 'centroCostoId' })
    centroCosto: CentroCosto;

    @Column({ nullable: true })
    centroCostoId: string;

    @Column('decimal', { precision: 15, scale: 2, default: 0, nullable: true, transformer: new ColumnNumericTransformer() })
    baseGravable: number;

    @ManyToOne(() => Impuesto, { nullable: true })
    @JoinColumn({ name: 'impuestoId' })
    impuesto: Impuesto;

    @Column({ nullable: true })
    impuestoId: string;

    @Column('decimal', { precision: 5, scale: 2, default: 0, nullable: true, transformer: new ColumnNumericTransformer() })
    porcentajeImpuesto: number;

    @Column({ type: 'varchar', length: 50, nullable: true })
    tipoImpuesto: string; // 'IVA' | 'RETENCION' | 'ICA' | 'OTRO'

    @Column({ type: 'varchar', length: 100, nullable: true })
    documentoReferencia: string;

    @CreateDateColumn()
    createdAt: Date;
}