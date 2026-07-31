import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TipoValorConcepto } from '../enums/tipo-valor-concepto.enum';

export class CreatePeriodoEmpleadoConceptoDto {
  @IsUUID()
  conceptoId: string;

  @IsNumber()
  @Min(0)
  valor: number;

  @IsOptional()
  @IsEnum(TipoValorConcepto)
  tipoValor?: TipoValorConcepto;

  @IsOptional()
  @IsString()
  observacion?: string;
}
