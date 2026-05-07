import { PaymentStatus, TipoPago } from "src/pagos/enums/pago.enum";

export interface AgingRow {
  id:          string;
  numero:      string;
  contraparte: string;   // nombre cliente o proveedor
  emision:     Date;
  vencimiento: Date | null;
  diasVencida: number;
  total:       number;
  pagado:      number;
  saldo:       number;
  paymentStatus: PaymentStatus;
  bucket:      'porVencer' | 'de1a30' | 'de31a60' | 'de61a90' | 'mas90';
}

export interface AgingGroup {
  contraparteId:   string;
  contraparteNombre: string;
  porVencer:       number;
  de1a30:          number;
  de31a60:         number;
  de61a90:         number;
  mas90:           number;
  total:           number;
  facturas:        AgingRow[];
}

export interface AgingReporte {
  grupos:    AgingGroup[];
  totales: {
    porVencer: number;
    de1a30:    number;
    de31a60:   number;
    de61a90:   number;
    mas90:     number;
    total:     number;
  };
  generadoEn: Date;
}

export interface HistorialPagosReporte {
  pagos: Array<{
    id:           string;
    tipo:         TipoPago;
    fecha:        Date;
    monto:        number;
    medioPago:    string;
    banco:        string | null;
    tipoCuenta:       string | null;
    numeroCuenta: string | null;
    referencia:   string | null;
    numeroFactura: string;
    contraparte:  string;
    numeroContraparte: string;
    creadoPor:    string;
    asientoId:    string | null;
  }>;
  totalCobros: number;
  totalPagos:  number;
  neto:        number;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ResumenCartera {
  cxc: {
    total:             number;
    porVencer:         number;
    vencida:           number;
    cantidadFacturas:  number;
  };
  cxp: {
    total:             number;
    porVencer:         number;
    vencida:           number;
    cantidadFacturas:  number;
  };
}

export interface ReporteAgingItemAgrupado {
  identificacion: string;
  sucursal: string;
  nombre: string;
  saldoCartera: number; // Total Facturado (Bruto)
  saldoFavor: number;   // Total Pagado + Notas
  deuda: number;        // Saldo Restante (Cartera - Favor)
  facturas: Array<{
    id: string;
    fecha: Date;
    vencimiento: Date | null;
    numeroFactura: string;
    totalFacturado: number;
    totalPagado: number;
    saldo: number;
    diasVencidos: number;
    estado: string;
  }>;
}

export interface ReporteAgingAgrupado {
  items: ReporteAgingItemAgrupado[];
  totales: { 
    totalCartera: number;   // Suma de todos los valores de facturas
    totalSaldoFavor: number; // Suma de pagos y notas
    totalDeuda: number;     // Suma de saldos restantes
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  generadoEn: Date;
}
