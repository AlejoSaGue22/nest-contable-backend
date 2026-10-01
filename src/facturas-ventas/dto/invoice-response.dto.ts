import { FacturasVenta } from "../entities/facturas-venta.entity";
import { FacturaCompra } from "src/facturas-compras/entities/factura-compra.entity";

export class InvoiceResponseDto {
  success: boolean;
  data: FacturasVenta | FacturasVenta[] | FacturaCompra | FacturaCompra[];
  message?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function toInvoiceResponse(
  data: FacturasVenta | FacturasVenta[] | FacturaCompra | FacturaCompra[],
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