import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTipoComprobanteDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  prefijo?: string;

  @IsNumber()
  @IsOptional()
  consecutivoActual?: number;

  @IsBoolean()
  @IsOptional()
  numeracionAutomatica?: boolean;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereAprobacion?: boolean;

  @IsBoolean()
  @IsOptional()
  docReferenciaObligatorio?: boolean;
}

export class UpdateTipoComprobanteDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  prefijo?: string;

  @IsNumber()
  @IsOptional()
  consecutivoActual?: number;

  @IsBoolean()
  @IsOptional()
  numeracionAutomatica?: boolean;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsBoolean()
  @IsOptional()
  requiereAprobacion?: boolean;

  @IsBoolean()
  @IsOptional()
  docReferenciaObligatorio?: boolean;
}
