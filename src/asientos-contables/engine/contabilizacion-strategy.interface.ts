import { QueryRunner } from 'typeorm';
import { DefinicionAsientoDto } from '../dto/definicion-asiento.dto';

export interface IContabilizacionStrategy {
  /**
   * Tipo de documento o asiento manejado por la estrategia.
   */
  readonly tipoDocumento: string;

  /**
   * Genera el DTO del asiento en memoria.
   * Acepta un queryRunner opcional para consultar datos consistentes dentro de transacciones activas.
   * Si strict=true, la estrategia debe fallar en vez de usar valores placeholder
   * (ej. referencia 'Borrador'): solo el modo preview permite placeholders.
   */
  generarDefinicion(documentoId: string, queryRunner?: QueryRunner, strict?: boolean): Promise<DefinicionAsientoDto>;
}
