/**
 * Tipo de nota de ajuste
 */
export enum TipoNota {
  /**
   * Nota Crédito - Disminuye el valor de la factura
   * Casos: Devoluciones, descuentos, anulaciones, correcciones
   */
  CREDITO = 'credito',
  
  /**
   * Nota Débito - Aumenta el valor de la factura
   * Casos: Intereses de mora, ajustes de precio, cargos adicionales
   */
  DEBITO = 'debito'
}

/**
 * Estados de la nota de ajuste
 */
export enum EstadoNota {
  BORRADOR = 'borrador',           // Creada pero no enviada
  ENVIADA = 'enviada',             // Enviada a DIAN
  PROCESANDO = 'procesando',       // DIAN procesando
  ACEPTADA = 'aceptada',           // DIAN aceptó
  RECHAZADA = 'rechazada',         // DIAN rechazó
  ANULADA = 'anulada'              // Nota anulada
}

/**
 * Estados DIAN de la nota
 */
export enum EstadoDIANNota {
  PENDIENTE = 'pendiente',
  ENVIADA = 'enviada',
  PROCESANDO = 'procesando',
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
  ANULADA = 'anulada'
}

/**
 * Conceptos de notas crédito según DIAN
 */
export enum ConceptoNotaCredito {
  DEVOLUCION_PARCIAL = '1',        // Devolución parcial de bienes/servicios
  ANULACION = '2',                 // Anulación de factura
  REBAJA_DESCUENTO = '3',          // Rebaja o descuento
  AJUSTE_PRECIO = '4',             // Ajuste de precio
  OTROS = '5'                      // Otros conceptos
}

/**
 * Conceptos de notas débito según DIAN
 */
export enum ConceptoNotaDebito {
  INTERESES = '1',                 // Intereses de mora
  GASTOS_COBRANZA = '2',           // Gastos de cobranza
  AJUSTE_PRECIO = '3',             // Ajuste de precio
  OTROS = '4'                      // Otros conceptos
}