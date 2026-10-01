import { TipoFactura, InvoiceStatus, DianStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { PaymentStatus, MedioPago, TipoPago } from 'src/pagos/enums/pago.enum';

export interface PeriodoReporte {
  fechaInicio: Date;
  fechaFin: Date;
}

export interface ReporteFacturacionAvanzada {
  periodo: PeriodoReporte;
  resumen: {
    totalFacturas: number;
    totalElectronicas: number;
    totalStandard: number;
    montoTotal: number;
    montoElectronicas: number;
    montoStandard: number;
    ivaTotal: number;
  };
  electronicas: {
    emitidas: number;
    aceptadas: number; // DianStatus.ACCEPTED
    rechazadas: number; // DianStatus.REJECTED
    pendientes: number; // DianStatus.PENDING | SENT | PROCESSING
    tasaAceptacion: number;
    montoPromedio: number;
  };
  standard: {
    emitidas: number;
    anuladas: number;
    montoPromedio: number;
    totalPagado: number;
    saldoPendiente: number;
  };
  topClientes: Array<{
    clienteId: string;
    clienteNombre: string;
    cantidadFacturas: number;
    montoTotal: number;
  }>;
  ventasPorDia: Array<{
    fecha: string;
    cantidadElectronicas: number;
    cantidadStandard: number;
    montoTotal: number;
  }>;
}

export interface ReporteConciliacionDIAN {
  periodo: PeriodoReporte;
  facturasElectronicas: {
    cantidad: number;
    montoDebito: number; // Lo que debería estar en contabilidad
    montoAcceptedDIAN: number; // Lo reportado (CUFE)
  };
  contabilidad: {
    saldoCuentasIngreso: number; // Suma de movimientos en 4135, 4155, etc.
    detallePorCuenta: Array<{
      codigo: string;
      nombre: string;
      saldo: number;
    }>;
  };
  diferencia: number;
  cuadra: boolean;
  explicacion?: string; // Por ejemplo: "La diferencia de $X corresponde a facturas de tipo STANDARD"
}

export interface ReporteConciliacionRecaudos {
  periodo: PeriodoReporte;
  totalPagosRegistrados: number; // Suma de la entidad Pago
  totalMovimientosBancos: number; // Suma de débitos en la cuenta 1110
  diferencia: number;
  cuadra: boolean;
  detallePorMedio: Array<{
    medio: MedioPago;
    monto: number;
  }>;
}

export interface ReporteImpuestos {
  periodo: PeriodoReporte;
  totalIVAGenerado: number;
  desglosePorTarifa: Array<{
    tarifa: number; // 0, 5, 19
    base: number;
    iva: number;
    cantidadItems: number;
  }>;
  porTipoFactura: {
    electronicas: { base: number; iva: number };
    standard: { base: number; iva: number };
  };
}

export interface DashboardAvanzadoKPIs {
  hoy: {
    cantidad: number;
    total: number;
    tasaRechazo: number;
  };
  semana: {
    cantidad: number;
    total: number;
    crecimiento: number; // vs semana anterior
  };
  mes: {
    cantidad: number;
    total: number;
    proyeccionFinMes: number;
    crecimiento: number; // vs mes anterior
  };
  alertas: {
    facturasRechazadas: number;
    saldosVencidos: number;
    erroresAsiento: number;
  };
}
