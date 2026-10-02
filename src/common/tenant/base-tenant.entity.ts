import { Column, JoinColumn, ManyToOne } from 'typeorm';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';

/**
 * Base aditiva multi-empresa (Fase 0, modo log-only).
 * NO cambia comportamiento: solo centraliza el patrón empresaId
 * para que futuros módulos la extiendan en vez de repetir columnas.
 * Enforcement real queda tras MULTI_EMPRESA_ENFORCED=true.
 */
export abstract class BaseTenantEntity {
  @ManyToOne(() => Empresa, { nullable: true })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column({ nullable: true })
  empresaId: string;
}
