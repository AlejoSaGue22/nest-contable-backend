import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { TipoNota, ConceptoNotaCredito, ConceptoNotaDebito } from "../enums/notas-ajuste.enum";
import { CreateItemNotaAjusteDto } from "./create-items-notas-ajuste.dto";

export class CreateNotasAjusteDto {

      // ========== TIPO ==========
  
  @IsEnum(TipoNota)
  @IsNotEmpty()
  tipo: TipoNota;
 
  // ========== FACTURA RELACIONADA ==========
  
  @IsUUID()
  @IsNotEmpty()
  facturaOriginalId: string;
 
  // ========== CONCEPTO Y MOTIVO ==========
  
  @IsString()
  @IsOptional()
  concepto?: string; // ConceptoNotaCredito o ConceptoNotaDebito
 
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;
 
  // ========== FECHAS ==========
  
  @IsString()
  @IsNotEmpty()
  fecha: string; // YYYY-MM-DD
 
  @IsString()
  @IsOptional()
  fechaVencimiento?: string;
 
  // ========== ITEMS ==========
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemNotaAjusteDto)
  @IsNotEmpty()
  items: CreateItemNotaAjusteDto[];
 
  // ========== OBSERVACIONES ==========
  
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  observaciones?: string;
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
