import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BaseTenantEntity } from 'src/common/tenant/base-tenant.entity';

@Entity({ name: 'profesionales_responsables' })
export class ProfesionalResponsable extends BaseTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  especialidad: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  registroProfesional: string | null;

  @Column({ type: 'varchar', nullable: true })
  firmaUrl: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
