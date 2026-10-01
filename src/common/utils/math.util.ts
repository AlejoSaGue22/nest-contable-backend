/**
 * Utilidad para realizar cálculos financieros con precisión de punto flotante.
 * Evita los errores comunes de JavaScript redondeando a 2 decimales en cada paso.
 */
export class MathUtil {
  /**
   * Redondea un número a la precisión especificada utilizando Number.EPSILON
   * para evitar errores de punto flotante (ej: 1.005 -> 1.01 en vez de 1.00)
   */
  static round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  /**
   * Suma dos números con precisión de 2 decimales
   */
  static sum(a: number, b: number): number {
    return this.round((a || 0) + (b || 0));
  }

  /**
   * Resta dos números con precisión de 2 decimales
   */
  static sub(a: number, b: number): number {
    return this.round((a || 0) - (b || 0));
  }

  /**
   * Multiplica dos números con precisión de 2 decimales
   */
  static mul(a: number, b: number): number {
    return this.round((a || 0) * (b || 0));
  }

  /**
   * Divide dos números con precisión de 2 decimales
   */
  static div(a: number, b: number): number {
    if (!b || b === 0) return 0;
    return this.round((a || 0) / b);
  }

  /**
   * Calcula el porcentaje de un valor
   * @param value Valor base
   * @param percentage Porcentaje (ej: 19 para 19%)
   */
  static percentage(value: number, percentage: number): number {
    return this.round(((value || 0) * (percentage || 0)) / 100);
  }
}
