import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { TipoNota } from "../enums/notas-ajuste.enum";
import { Type } from "class-transformer";

/**
 * DTO para filtros de búsqueda
 */
export class NotasAjusteFilterDto {
  
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;
 
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
 
  /**
   * Filtrar por tipo
   */
  @IsEnum(TipoNota)
  @IsOptional()
  tipo?: TipoNota;
 
  /**
   * Filtrar por estado
   */
  @IsString()
  @IsOptional()
  estado?: string;
 
  /**
   * Filtrar por estado DIAN
   */
  @IsString()
  @IsOptional()
  estadoDIAN?: string;
 
  /**
   * Buscar por número de factura original
   */
  @IsString()
  @IsOptional()
  facturaNumero?: string;
 
  /**
   * Buscar por nombre de cliente
   */
  @IsString()
  @IsOptional()
  clienteNombre?: string;
 
  /**
   * Fecha inicio
   */
  @IsString()
  @IsOptional()
  fechaInicio?: string;
 
  /**
   * Fecha fin
   */
  @IsString()
  @IsOptional()
  fechaFin?: string;
}
 
/**
 * DTO para respuesta de nota de ajuste
 */
export class NotaAjusteResponseDto {
  id: string;
  tipo: TipoNota;
  numeroCompleto: string;
  facturaOriginalNumero: string;
  clienteNombre: string;
  motivo: string;
  fecha: Date;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  estadoDIAN: string;
  cufe?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  createdAt: Date;
}
 
/**
 * Helper para convertir entidad a DTO de respuesta
 */
export function toNotaAjusteResponse(
  nota: any,
  mensaje?: string
): { success: boolean; message?: string; data: NotaAjusteResponseDto | NotaAjusteResponseDto[] } {
  
  const mapear = (n: any): NotaAjusteResponseDto => ({
    id: n.id,
    tipo: n.tipo,
    numeroCompleto: n.numeroCompleto,
    facturaOriginalNumero: n.facturaOriginalNumero,
    clienteNombre: n.cliente?.nombre || 'N/A',
    motivo: n.motivo,
    fecha: n.fecha,
    subtotal: Number(n.subtotal),
    iva: Number(n.iva),
    total: Number(n.total),
    estado: n.estado,
    estadoDIAN: n.estadoDIAN,
    cufe: n.cufe,
    pdfUrl: n.pdfUrl,
    xmlUrl: n.xmlUrl,
    createdAt: n.createdAt
  });
 
  if (Array.isArray(nota)) {
    return {
      success: true,
      message: mensaje || 'Notas obtenidas exitosamente',
      data: nota.map(mapear)
    };
  }
 
  return {
    success: true,
    message: mensaje || 'Nota obtenida exitosamente',
    data: mapear(nota)
  };
}