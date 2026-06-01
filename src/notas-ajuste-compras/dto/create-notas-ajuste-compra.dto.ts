import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested, MaxLength, IsNumber } from "class-validator";
import { Type } from "class-transformer";
import { TipoNotaCompra } from "../enums/notas-ajuste-compra.enum";
import { CreateItemNotaAjusteCompraDto } from "./create-items-notas-ajuste-compra.dto";

export class CreateNotasAjusteCompraDto {

  @IsEnum(TipoNotaCompra)
  @IsNotEmpty()
  tipo: TipoNotaCompra;

  @IsNotEmpty()
  isDraft: boolean;

  @IsUUID()
  @IsNotEmpty()
  facturaOriginalId: string;

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
  @Type(() => CreateItemNotaAjusteCompraDto)
  @IsNotEmpty()
  items: CreateItemNotaAjusteCompraDto[];

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
