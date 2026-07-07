export enum TipoFactura {
  ELECTRONICA = 'ELECTRONICA',
  STANDARD = 'ESTANDAR',
}

export enum FormaPago {
  CONTADO = 'CONTADO', // 1
  CREDITO = 'CREDITO', // 2
}

export enum InvoiceStatus {
  DRAFT = 'draft',              // Borrador - editable
  PENDING_DIAN = 'pending_dian', // Enviando a DIAN
  ACCEPTED = 'accepted',         // Aceptada por DIAN (tiene CUFE)
  REJECTED = 'rejected',         // Rechazada por DIAN (corregir y reenviar)
  PAID = 'paid',                 // Pagada
  CANCELLED = 'anulada',        // Anulada (requiere nota crédito)
  ISSUED = 'issued',             // Emitida (para facturas comunes)
  ERROR_ASIENTO = 'error_asiento' // Error generado el asiento
}

export enum DianStatus {
  PENDING = 'pending',           // Esperando envío
  SENT = 'sent',                 // Enviada a proveedor tecnológico
  PROCESSING = 'processing',     // Proveedor validando
  ACCEPTED = 'accepted',         // DIAN aprobó (tiene CUFE)
  REJECTED = 'rejected',         // DIAN rechazó
  CANCELLED = 'anulada'        // Anulada (nota crédito enviada)
}