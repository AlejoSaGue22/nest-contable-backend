export class ColumnNumericTransformer {
  /**
   * Llamado al ESCRIBIR en la base de datos.
   * Previene que undefined/NaN se guarden como 0 silenciosamente en columnas DECIMAL.
   */
  to(data: number): number {
    if (data === undefined || data === null) return 0;
    const n = Number(data);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Llamado al LEER desde la base de datos.
   * MySQL puede retornar DECIMAL como string ("1350500.00") o como number según el driver.
   */
  from(data: string | number | null | undefined): number {
    if (data === null || data === undefined) return 0;
    const n = typeof data === 'string' ? parseFloat(data) : Number(data);
    return isNaN(n) ? 0 : n;
  }
}
