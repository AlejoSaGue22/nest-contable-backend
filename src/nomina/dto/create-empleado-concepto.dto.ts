import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TipoValorConcepto } from '../enums/tipo-valor-concepto.enum';

export class CreateEmpleadoConceptoDto {
  @IsString()
  @IsNotEmpty()
  conceptoId: string;

  @IsNumber()
  @Min(0)
  valor: number;

  @IsEnum(TipoValorConcepto)
  @IsOptional()
  tipoValor?: TipoValorConcepto;

  @IsDateString()
  @IsNotEmpty()
  fechaInicio: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsString()
  @IsOptional()
  observacion?: string;
}
