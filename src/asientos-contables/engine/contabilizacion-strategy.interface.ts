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
   */
  generarDefinicion(documentoId: string, queryRunner?: QueryRunner): Promise<DefinicionAsientoDto>;
}
