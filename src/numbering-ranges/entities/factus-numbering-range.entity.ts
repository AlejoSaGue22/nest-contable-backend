import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Dominio del rango de numeración.
 * - billing: facturas electrónicas (01), notas crédito y débito.
 * - payroll: nómina electrónica y notas de ajuste de nómina.
 */
export type NumberingRangeDomain = 'billing' | 'payroll';

/**
 * Caché persistente de los rangos de numeración DIAN gestionados en Factus.
 *
 * La resolución DIAN es un dato de baja volatilidad (cambia cada 6-24 meses,
 * por agotamiento o por toggle manual), por eso se cachea en BD + memoria y
 * solo se sincroniza contra la API en intervalos programados, bajo demanda
 * administrativa o por invalidación reactiva (422 de rango en una emisión).
 *
 * Fuente: GET /v2/numbering-ranges (billing) y rango de nómina (payroll).
 */
@Entity('factus_numbering_ranges')
@Unique(['domain', 'factusId'])
@Index('IDX_nr_domain_document', ['domain', 'document'])
export class FactusNumberingRange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID del rango en Factus (no es PK local para permitir billing+payroll). */
  @Column({ name: 'factus_id', type: 'int' })
  factusId: number;

  @Column({ type: 'varchar', length: 20, default: 'billing' })
  domain: NumberingRangeDomain;

  /**
   * Código interno de documento, normalizado desde el nombre que devuelve
   * Factus ('01' FE, 'NC', 'ND', 'DS', 'NA', 'NOM').
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  document: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  prefix: string | null;

  @Column({ name: 'resolution_number', type: 'varchar', length: 80, nullable: true })
  resolutionNumber: string | null;

  @Column({ name: 'technical_key', type: 'varchar', length: 120, nullable: true })
  technicalKey: string | null;

  @Column({ name: 'from_number', type: 'int', nullable: true })
  fromNumber: number | null;

  @Column({ name: 'to_number', type: 'int', nullable: true })
  toNumber: number | null;

  /** Consecutivo actual reportado por Factus (solo informativo/alertas). */
  @Column({ name: 'current_number', type: 'int', nullable: true })
  currentNumber: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_expired', type: 'boolean', default: false })
  isExpired: boolean;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true })
  validTo: Date | null;

  /** Última sincronización exitosa contra Factus. */
  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;

  /** Origen del registro: 'api' (sincronizado) o 'env' (override manual). */
  @Column({ type: 'varchar', length: 10, default: 'api' })
  source: string;

  /**
   * Empresa dueña del rango. Null = global (una sola empresa hoy).
   * Reservado para el futuro multi-empresa.
   */
  @Column({ name: 'empresa_id', type: 'uuid', nullable: true })
  empresaId: string | null;

  /** Última emisión que resolvió este rango (auditoría de uso). */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  /** Payload crudo de Factus para depuración. */
  @Column({ name: 'raw_json', type: 'jsonb', nullable: true })
  rawJson: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
