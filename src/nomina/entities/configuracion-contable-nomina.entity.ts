import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { AreaEmpleado } from '../enums/area-empleado.enum';

@Entity('configuracion_contable_nomina')
@Unique(['empresaId', 'area'])
export class ConfiguracionContableNomina {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;

  @Column({ type: 'enum', enum: AreaEmpleado })
  area: AreaEmpleado;

  @Column({ type: 'json' })
  configuracion: {
    conceptos: Record<
      string,
      { cuentaId: string | null; codigo: string | null; nombre: string | null }
    >;
    deduccionesTrabajador: Record<
      string,
      {
        cuentaPasivoId: string | null;
        cuentaPasivoCodigo?: string | null;
        cuentaPasivoNombre?: string | null;
      }
    >;
    aportesEmpleador: Record<
      string,
      {
        cuentaGastoId: string | null;
        cuentaGastoCodigo?: string | null;
        cuentaGastoNombre?: string | null;
        cuentaPasivoId: string | null;
        cuentaPasivoCodigo?: string | null;
        cuentaPasivoNombre?: string | null;
      }
    >;
    provisiones: Record<
      string,
      {
        cuentaGastoId: string | null;
        cuentaGastoCodigo?: string | null;
        cuentaGastoNombre?: string | null;
        cuentaPasivoId: string | null;
        cuentaPasivoCodigo?: string | null;
        cuentaPasivoNombre?: string | null;
      }
    >;
    cajaBanco: {
      cuentaObligacionesLabId: string | null;
      cuentaObligacionesLabCodigo?: string | null;
      cuentaObligacionesLabNombre?: string | null;
    };
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
