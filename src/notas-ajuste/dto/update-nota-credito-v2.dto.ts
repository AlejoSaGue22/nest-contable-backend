import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConceptoNotaCredito } from '../enums/notas-ajuste.enum';
import { NotaCreditoV2ItemDto } from './create-nota-credito-v2.dto';

/**
 * Edición de borrador NC V2 (solo DRAFT). La factura no cambia;
 * el concepto sí puede cambiar (se recalcula todo desde la fuente).
 */
export class UpdateNotaCreditoV2Dto {
  @IsEnum(ConceptoNotaCredito)
  @IsNotEmpty()
  concepto: ConceptoNotaCredito;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;

  @IsString()
  @IsNotEmpty()
  fecha: string;

  @IsBoolean()
  @IsOptional()
  esReembolsoAbono?: boolean;

  @IsBoolean()
  @IsOptional()
  aplicarDescuentoATodo?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  descuentoTasaGlobal?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  descuentoValorGlobal?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotaCreditoV2ItemDto)
  @IsOptional()
  items?: NotaCreditoV2ItemDto[];
}
