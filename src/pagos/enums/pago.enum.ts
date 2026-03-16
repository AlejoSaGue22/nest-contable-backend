export enum PaymentStatus {
  PENDING = 'pendiente',   // Sin pagos registrados (solo aplica a crédito)
  PARTIAL = 'parcial',   // Abonos parciales, aún hay saldo
  PAID = 'pagado',      // Pagado en su totalidad
  OVERDUE = 'vencido',   // Venció sin pagar (cron job lo marca)
  CANCELLED = 'anulado', // factura anulada
}

export enum TipoPago {
  COBRO = 'cobro', // Recibimos dinero (venta)
  PAGO  = 'pago',  // Pagamos dinero   (compra)
}

export enum MedioPago {
  CAJA          = 'caja',
  BANCO         = 'banco',
  TRANSFERENCIA = 'transferencia',
  CHEQUE        = 'cheque',
}
