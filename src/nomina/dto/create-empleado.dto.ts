import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoDocumentoIdentidad } from '../enums/tipo-documento.enum';
import { TipoContrato } from '../enums/tipo-contrato.enum';
import { AreaEmpleado } from '../enums/area-empleado.enum';

export class CreateEmpleadoDto {
  @IsEnum(AreaEmpleado)
  @IsOptional()
  area?: AreaEmpleado;

  @IsEnum(TipoDocumentoIdentidad)
  @IsNotEmpty()
  tipoDocumento: TipoDocumentoIdentidad;

  @IsString()
  @IsNotEmpty()
  numeroDocumento: string;

  @IsString()
  @IsNotEmpty()
  primerNombre: string;

  @IsString()
  @IsOptional()
  segundoNombre?: string;

  @IsString()
  @IsNotEmpty()
  primerApellido: string;

  @IsString()
  @IsOptional()
  segundoApellido?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  centroCostoId?: string;

  @IsDateString()
  @IsNotEmpty()
  fechaIngreso: string;

  @IsOptional()
  @IsString()
  fechaRetiro?: string;

  @IsString()
  @IsOptional()
  tipoContratoId?: string;

  @IsEnum(TipoContrato)
  @IsOptional()
  tipoContrato?: TipoContrato;

  @IsString()
  @IsOptional()
  cargoId?: string;

  @IsNumber()
  @Min(0)
  salarioBase: number;

  @IsBoolean()
  @IsOptional()
  salarioIntegral?: boolean;

  @IsString()
  @IsNotEmpty()
  epsId: string;

  @IsString()
  @IsNotEmpty()
  afpId: string;

  @IsString()
  @IsOptional()
  ccfId?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  arlNivelRiesgo?: number;

  @IsBoolean()
  @IsOptional()
  auxilioTransporte?: boolean;

  @IsString()
  @IsOptional()
  metodoPago?: string;

  @IsString()
  @IsOptional()
  bancoId?: string;

  @IsString()
  @IsOptional()
  tipoCuentaBancaria?: string;

  @IsString()
  @IsOptional()
  numeroCuentaBancaria?: string;
}
