import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, IsUUID } from "class-validator";

/**
 * DTO para items de nota de ajuste
 */
export class CreateItemNotaAjusteDto {
  
  @IsUUID()
  @IsOptional()
  articuloId?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  descripcion: string;
 
  @IsNumber()
  @Min(0.01)
  cantidad: number;
 
  @IsNumber()
  @Min(0)
  valorUnitario: number;
 
  @IsNumber()
  @Min(0)
  @IsOptional()
  porcentajeIVA?: number;
}