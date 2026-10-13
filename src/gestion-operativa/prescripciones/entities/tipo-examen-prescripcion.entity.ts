import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BaseTenantEntity } from 'src/common/tenant/base-tenant.entity';

@Entity({ name: 'tipos_examen_prescripcion' })
@Index('UQ_tipos_examen_prescripcion_empresa_codigo', ['empresaId', 'codigo'], { unique: true, where: '"empresaId" IS NOT NULL' })
@Index('UQ_tipos_examen_prescripcion_codigo_global', ['codigo'], { unique: true, where: '"empresaId" IS NULL' })
export class TipoExamenPrescripcion extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 40 })
  codigo: string;

  @Column({ length: 100 })
  nombre: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
