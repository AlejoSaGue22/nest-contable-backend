import { IsString, IsNotEmpty, IsEnum, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';
import { TipoCuentaBancaria } from '../entities/cuentas-bancaria.entity';

export class CreateCuentasBancariaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  bancoId: string;

  @IsString()
  @IsOptional()
  numeroCuenta?: string;

  @IsEnum(TipoCuentaBancaria)
  @IsNotEmpty()
  tipoCuenta: TipoCuentaBancaria;

  @IsNumber()
  @IsOptional()
  @Min(0)
  saldoInicial?: number;

  @IsString()
  @IsOptional()
  cuentaContrapartidaCodigo?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
