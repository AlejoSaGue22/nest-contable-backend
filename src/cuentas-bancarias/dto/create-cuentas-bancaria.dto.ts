import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { TipoCuentaBancaria } from '../entities/cuentas-bancaria.entity';
import { ToOptionalNumber } from 'src/common/decorators/to-number.decorator';

export class CreateCuentasBancariaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  bancoId?: string;

  @IsString()
  @IsOptional()
  numeroCuenta?: string;

  @IsEnum(TipoCuentaBancaria)
  @IsNotEmpty()
  tipoCuenta: TipoCuentaBancaria;

  @IsString()
  @IsNotEmpty()
  codigoCuentaContable: string;

  @IsNumber()
  @IsOptional()
  @ToOptionalNumber()
  saldoInicial?: number;

  @IsString()
  @IsOptional()
  cuentaContrapartidaCodigo?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
