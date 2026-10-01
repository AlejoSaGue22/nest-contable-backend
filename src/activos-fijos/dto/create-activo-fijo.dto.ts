import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';

export class CreateActivoFijoDto {
  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsNotEmpty()
  tipoActivo: string;

  @IsDateString()
  @IsNotEmpty()
  fechaAdquisicion: string;

  @IsNumber()
  @Min(0)
  valorAdquisicion: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  valorSalvamento?: number;

  @IsNumber()
  @Min(1)
  vidaUtilMeses: number;

  @IsString()
  @IsNotEmpty()
  cuentaActivoId: string;

  @IsString()
  @IsNotEmpty()
  cuentaDepreciacionAcumuladaId: string;

  @IsString()
  @IsNotEmpty()
  cuentaGastoDepreciacionId: string;

  @IsString()
  @IsOptional()
  proveedorId?: string;

  @IsString()
  @IsOptional()
  centroCostoId?: string;
}
