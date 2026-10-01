import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class NotaAjusteSoporteFilterDto {
  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  documentoNumero?: string;

  @IsOptional()
  @IsString()
  proveedorNombre?: string;

  @IsOptional()
  @IsString()
  fechaInicio?: string;

  @IsOptional()
  @IsString()
  fechaFin?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10;
}
