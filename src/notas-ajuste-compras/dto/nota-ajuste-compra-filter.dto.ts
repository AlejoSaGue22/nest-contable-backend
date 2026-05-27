import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { TipoNotaCompra } from "../enums/notas-ajuste-compra.enum";
import { Type } from "class-transformer";

export class NotasAjusteCompraFilterDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;
 
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
 
  @IsEnum(TipoNotaCompra)
  @IsOptional()
  tipo?: TipoNotaCompra;
 
  @IsString()
  @IsOptional()
  estado?: string;
 
  @IsString()
  @IsOptional()
  facturaNumero?: string;
 
  @IsString()
  @IsOptional()
  proveedorNombre?: string;
 
  @IsString()
  @IsOptional()
  fechaInicio?: string;
 
  @IsString()
  @IsOptional()
  fechaFin?: string;
}

export class NotaAjusteCompraResponseDto {
  id: string;
  tipo: TipoNotaCompra;
  numeroCompleto: string;
  facturaOriginalNumero: string;
  proveedorNombre: string;
  motivo: string;
  fecha: Date;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  createdAt: Date;
}

export function toNotaAjusteCompraResponse(
  nota: any,
  mensaje?: string
): { success: boolean; message?: string; data: NotaAjusteCompraResponseDto | NotaAjusteCompraResponseDto[] } {
  
  const mapear = (n: any): NotaAjusteCompraResponseDto => ({
    id: n.id,
    tipo: n.tipo,
    numeroCompleto: n.numeroCompleto,
    facturaOriginalNumero: n.facturaOriginalNumero,
    proveedorNombre: n.proveedor?.nombre || 'N/A',
    motivo: n.motivo,
    fecha: n.fecha,
    subtotal: Number(n.subtotal),
    iva: Number(n.iva),
    total: Number(n.total),
    estado: n.estado,
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
    data: nota
  };
}
