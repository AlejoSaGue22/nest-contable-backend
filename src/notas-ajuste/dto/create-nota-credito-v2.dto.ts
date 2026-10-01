import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConceptoNotaCredito } from '../enums/notas-ajuste.enum';

/**
 * DTO V2 de Nota Crédito (guía NC 2026): el concepto DIAN controla el input.
 * Solo se envía el dato correspondiente al concepto; el backend recalcula
 * todo (fuente de verdad) y resuelve formapago/payment_details internamente.
 *
 * - '1' Devolución parcial → cantidad (por línea).
 * - '2' Anulación → items vacío (el backend expande el 100%).
 * - '3'/'5'/'6' Descuento → descuentoTasa (%) o descuentoValor ($) por línea,
 *   opcional aplicarDescuentoATodo con descuentoTasaGlobal/descuentoValorGlobal.
 * - '4' Ajuste de precio → precioNuevo (precio vigente, NO la diferencia).
 */
export class NotaCreditoV2ItemDto {
  @IsUUID()
  @IsNotEmpty()
  articuloId: string;

  /** Concepto 1: cantidad a devolver (0 < q <= disponible). */
  @IsNumber()
  @Min(0)
  @IsOptional()
  cantidad?: number;

  /** Concepto 4: precio vigente propuesto (0 <= p < precio original). */
  @IsNumber()
  @Min(0)
  @IsOptional()
  precioNuevo?: number;

  /** Conceptos 3/5/6: tasa de descuento en % (0-100). */
  @IsNumber()
  @Min(0)
  @IsOptional()
  descuentoTasa?: number;

  /** Conceptos 3/5/6: valor de descuento en $. Excluyente con tasa. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  descuentoValor?: number;
}

export class CreateNotaCreditoV2Dto {
  @IsUUID()
  @IsNotEmpty()
  facturaOriginalId: string;

  @IsEnum(ConceptoNotaCredito)
  @IsNotEmpty()
  concepto: ConceptoNotaCredito;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;

  /** YYYY-MM-DD */
  @IsString()
  @IsNotEmpty()
  fecha: string;

  /** Solo estándar. En electrónica siempre es borrador → emitir. */
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;

  @IsBoolean()
  @IsOptional()
  esReembolsoAbono?: boolean;

  /** Conceptos 3/5/6: aplica el descuento global a todas las líneas. */
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
