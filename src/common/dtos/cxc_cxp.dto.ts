import { PaymentStatus } from "src/pagos/enums/pago.enum";

export interface AgingCxp {
    porProveedor: Array<{
      proveedorId:    string;
      proveedorNombre: string;
      porVencer:      number;
      de1a30:         number;
      de31a60:        number;
      de61a90:        number;
      mas90:          number;
      total:          number;
    }>;
    totales: AgingBucket & { total: number };
}

export interface AgingBucket {
  porVencer:  number;
  de1a30:     number;
  de31a60:    number;
  de61a90:    number;
  mas90:      number;
}

export interface CxcItem {
  facturaId:        string;
  numeroFactura:    string;
  clienteId:        string;
  clienteNombre:    string;
  fechaEmision:     Date;
  fechaVencimiento: Date | null;
  diasVencida:      number;      // Negativo = aún no vence; positivo = días vencida
  total:            number;
  totalPagado:      number;
  saldoPendiente:   number;
  paymentStatus:    PaymentStatus;
  agingBucket:      keyof AgingBucket;
}

export interface CxcResumen {
  totalCartera:   number;
  porVencer:      number;
  vencida:        number;
  cantidadPorVencer: number;
  cantidadVencida:   number;
}

export interface CxpItem {
  facturaId:        string;
  numeroFactura:    string | null;
  proveedorId:      string;
  proveedorNombre:  string;
  fechaEmision:     Date;
  fechaVencimiento: Date | null;
  diasVencida:      number;
  total:            number;
  totalPagado:      number;
  saldoPendiente:   number;
  paymentStatus:    PaymentStatus;
  agingBucket:      keyof AgingBucket;
}

export interface CxpResumen {
  totalPorPagar:     number;
  porVencer:         number;
  vencida:           number;
  cantidadPorVencer: number;
  cantidadVencida:   number;
}

export interface CxFiltros {
  clienteId?: string;
  proveedorId?: string;
  paymentStatus?: PaymentStatus;
  soloVencidas?: boolean;
  page?: number;
  limit?: number;
}