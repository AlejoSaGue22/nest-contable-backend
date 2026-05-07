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
  deuda: number;        // Deuda por cobrar / pagar
  saldoFavor: number;   // Saldo a favor
  saldoCartera: number; // Saldo cartera (Deuda - Saldo a favor)
  facturas: Array<{
    id: string;
    fecha: Date;
    vencimiento: Date | null;
    numeroFactura: string;
    saldo: number;
    diasVencidos: number;
    estado: string;
  }>;
}

export interface ReporteAgingAgrupado {
  items: ReporteAgingItemAgrupado[];
  totales: {
    totalDeuda: number;
    totalSaldoFavor: number;
    totalCartera: number;
  };
  generadoEn: Date;
}
