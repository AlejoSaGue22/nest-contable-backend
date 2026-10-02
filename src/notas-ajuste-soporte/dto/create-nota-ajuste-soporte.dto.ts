import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested, MaxLength, IsNumber } from "class-validator";
import { Type } from "class-transformer";
import { TipoNotaCompra } from "src/notas-ajuste-compras/enums/notas-ajuste-compra.enum";
import { CreateItemNotaAjusteSoporteDto } from "./create-item-nota-ajuste-soporte.dto";

export class CreateNotaAjusteSoporteDto {

  @IsEnum(TipoNotaCompra)
  @IsNotEmpty()
  tipo: TipoNotaCompra;

  @IsNotEmpty()
  isDraft: boolean;

  @IsUUID()
  @IsNotEmpty()
  documentoOriginalId: string;

  /** Código DIAN del motivo de corrección (correction_concept_code). Requerido si el DSE origen es electrónico. */
  @IsString()
  @IsOptional()
  conceptoCorreccion?: string;

  @IsString()
  @IsNotEmpty()
  formaPago: string;

  @IsString()
  @IsOptional()
  metodoPago?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;

  @IsString()
  @IsNotEmpty()
  fecha: string; // YYYY-MM-DD

  @IsString()
  @IsOptional()
  fechaVencimiento?: string;

  @IsBoolean()
  @IsOptional()
  esReembolsoAbono?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemNotaAjusteSoporteDto)
  @IsNotEmpty()
  items: CreateItemNotaAjusteSoporteDto[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  observaciones?: string;

  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @IsNumber()
  @IsOptional()
  descuento?: number;

  @IsNumber()
  @IsOptional()
  iva?: number;

  @IsNumber()
  @IsOptional()
  total?: number;
}
