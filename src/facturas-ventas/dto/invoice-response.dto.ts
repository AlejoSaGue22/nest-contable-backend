import { FacturasVenta } from "../entities/facturas-venta.entity";

export class InvoiceResponseDto {
  success: boolean;
  data: FacturasVenta | FacturasVenta[];
  message?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function toInvoiceResponse(
  data: FacturasVenta | FacturasVenta[], 
  message?: string, 
  meta?: any
): InvoiceResponseDto {
  return {
    success: true,
    data,
    message,
    meta
  };
}