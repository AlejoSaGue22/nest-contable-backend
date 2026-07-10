export interface DefinicionDetalleAsientoDto {
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debito: number;
  credito: number;
  concepto: string;
  
  // Información analítica para el libro auxiliar/mayor
  clienteId?: string;
  proveedorId?: string;
  terceroId?: string;
  terceroNombre?: string;
  centroCostoId?: string;
  centroCostoNombre?: string;
  
  // Desglose fiscal
  baseGravable?: number;
  impuestoId?: string;
  porcentajeImpuesto?: number;
  tipoImpuesto?: 'IVA' | 'RETENCION' | 'ICA' | 'OTRO';
  documentoReferencia?: string;
}

export interface DefinicionAsientoDto {
  tipo: string; // TipoAsiento enum equivalent
  fecha: Date;
  referencia: string;
  descripcion: string;
  detalles: DefinicionDetalleAsientoDto[];
  totalDebito: number;
  totalCredito: number;
  estaBalanceado: boolean;
  diferencia: number;
}
