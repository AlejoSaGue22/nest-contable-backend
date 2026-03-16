import { Pago } from '../entities/pago.entity';
import { PaymentStatus } from '../enums/pago.enum';

// ─────────────────────────────────────────────────────────────
// Tipos de datos que pueden viajar en el campo `data`
// ─────────────────────────────────────────────────────────────
export type PagoData = Pago | Pago[];

// ─────────────────────────────────────────────────────────────
// Resumen de estado de cuenta (CxC / CxP)
// ─────────────────────────────────────────────────────────────
export interface ResumenCuentaDto {
  /** Total de la deuda / cartera original */
  totalDeuda: number;
  /** Monto ya pagado / cobrado */
  totalPagado: number;
  /** Saldo pendiente */
  saldoPendiente: number;
  /** Estado de pago consolidado */
  paymentStatus: PaymentStatus;
}

// ─────────────────────────────────────────────────────────────
// Bucket de antigüedad (aging report)
// ─────────────────────────────────────────────────────────────
export interface AgingBucketDto {
  /** Nombre del bucket, e.g. "0-30 días" */
  rango: string;
  /** Deuda/cartera en ese rango de días */
  monto: number;
  /** Número de documentos en el rango */
  cantidad: number;
}

// ─────────────────────────────────────────────────────────────
// Paginación (para listados)
// ─────────────────────────────────────────────────────────────
export interface PagoMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class PagoResponseDto<T = PagoData | ResumenCuentaDto | AgingBucketDto[]> {
  success: boolean;
  data: T;
  message?: string;
  meta?: PagoMetaDto;
}

export function toPagoResponse<T = PagoData | ResumenCuentaDto | AgingBucketDto[]>(
  data: T,
  message?: string,
  meta?: PagoMetaDto,
): PagoResponseDto<T> {
  return {
    success: true,
    data,
    message,
    meta,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper: construir respuesta de error
// ─────────────────────────────────────────────────────────────
export function toPagoErrorResponse(message: string): PagoResponseDto {
  return {
    success: false,
    data: [],
    message,
  };
}
