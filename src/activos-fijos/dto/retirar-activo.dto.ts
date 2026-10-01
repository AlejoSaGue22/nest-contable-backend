import { IsString, IsNotEmpty, IsDateString, IsNumber, Min, IsOptional } from 'class-validator';

export class RetirarActivoDto {
  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsString()
  @IsNotEmpty()
  motivo: string;

  @IsNumber()
  @Min(0)
  valorVenta: number;

  @IsString()
  @IsOptional()
  cuentaIngresoRetiroId?: string;

  @IsString()
  @IsOptional()
  cuentaPerdidaRetiroId?: string;

  @IsString()
  @IsOptional()
  cuentaBancoCajaId?: string;
}
