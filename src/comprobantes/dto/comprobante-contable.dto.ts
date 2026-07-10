import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateComprobanteDetalleDto {
  @IsUUID()
  @IsNotEmpty()
  cuentaContableId: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsNumber()
  @Min(0)
  debito: number;

  @IsNumber()
  @Min(0)
  credito: number;

  @IsUUID()
  @IsOptional()
  clienteId?: string;

  @IsUUID()
  @IsOptional()
  proveedorId?: string;

  @IsUUID()
  @IsOptional()
  centroCostoId?: string;

  @IsString()
  @IsOptional()
  documentoReferencia?: string;
}

export class CreateComprobanteContableDto {
  @IsUUID()
  @IsNotEmpty()
  tipoComprobanteId: string;

  @IsDateString()
  @IsNotEmpty()
  fechaDocumento: string;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateComprobanteDetalleDto)
  @IsNotEmpty()
  detalles: CreateComprobanteDetalleDto[];
}

export class UpdateComprobanteContableDto {
  @IsDateString()
  @IsOptional()
  fechaDocumento?: string;

  @IsString()
  @IsOptional()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateComprobanteDetalleDto)
  @IsOptional()
  detalles?: CreateComprobanteDetalleDto[];
}

export class AnularComprobanteDto {
  @IsString()
  @IsNotEmpty()
  motivoAnulacion: string;
}
