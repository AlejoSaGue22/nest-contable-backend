import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID, Min } from 'class-validator';

export class CreateImpuestoDto {
  @IsString()
  nombre: string;

  @IsString()
  tipo: string;

  @IsNumber()
  @Min(0)
  tarifa: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsBoolean()
  isAcreditable?: boolean;

  @IsOptional()
  @IsUUID()
  cuentaVentasId?: string;

  @IsOptional()
  @IsUUID()
  cuentaComprasId?: string;

  @IsOptional()
  @IsUUID()
  cuentaDevVentasId?: string;

  @IsOptional()
  @IsUUID()
  cuentaDevComprasId?: string;
}
