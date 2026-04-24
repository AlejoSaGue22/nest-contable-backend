import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested, MaxLength, IsNumber, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { TipoNota, ConceptoNotaCredito, ConceptoNotaDebito } from "../enums/notas-ajuste.enum";
import { CreateItemNotaAjusteDto } from "./create-items-notas-ajuste.dto";

export class CreateNotasAjusteDto {

  
  @IsEnum(TipoNota)
  @IsNotEmpty()
  tipo: TipoNota;
 
  // ========== FACTURA RELACIONADA ==========
  
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
  @IsOptional()
  concepto?: string; // ConceptoNotaCredito o ConceptoNotaDebito
 
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
 
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemNotaAjusteDto)
  @IsNotEmpty()
  items: CreateItemNotaAjusteDto[];

  @IsBoolean()
  @IsOptional()
  esReembolsoAbono?: boolean; // Solo para Nota Crédito, indica si es un reembolso/abono a favor del cliente
 
  // ========== OBSERVACIONES ==========
  
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


/**
 * DTO específico para Nota Crédito
 */
export class CreateNotaCreditoDto extends CreateNotasAjusteDto {
  
  @IsEnum(ConceptoNotaCredito)
  @IsNotEmpty()
  declare concepto: ConceptoNotaCredito;

  tipo: TipoNota = TipoNota.CREDITO;
}
 
/**
 * DTO específico para Nota Débito
 */
export class CreateNotaDebitoDto extends CreateNotasAjusteDto {
  
  @IsEnum(ConceptoNotaDebito)
  @IsNotEmpty()
  declare concepto?: ConceptoNotaDebito;
    
  tipo: TipoNota = TipoNota.DEBITO;
}
