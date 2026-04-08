import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, IsUUID } from "class-validator";

export class CreateItemNotaAjusteDto {
  
  @IsUUID()
  @IsNotEmpty()
  articuloId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  descripcion: string;
 
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  cantidad: number;
 
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  valorUnitario: number;
 
  @IsNumber()
  @Min(0)
  @IsOptional()
  porcentajeIVA?: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  descuento: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  subtotal: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  total: number;
}