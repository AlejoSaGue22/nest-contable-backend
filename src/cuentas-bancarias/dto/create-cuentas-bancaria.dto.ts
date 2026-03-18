import { IsString, IsNotEmpty, IsEnum, IsNumber, IsBoolean, IsOptional } from 'class-validator';
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


  @IsString()
  @IsOptional()
  observaciones?: string;
}
