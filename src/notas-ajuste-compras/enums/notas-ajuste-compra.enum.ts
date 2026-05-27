export enum TipoNotaCompra {
  CREDITO = 'credito',
  DEBITO = 'debito'
}

export enum EstadoNotaCompra {
  DRAFT = 'borrador',               
  ISSUED = 'emitida', // Equivalente a Registrada               
  CANCELLED = 'anulada',            
  ERROR_ASIENTO = 'error_asiento'   
}
