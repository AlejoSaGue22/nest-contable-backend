import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MedioPago } from '../enums/pago.enum';

export class PagoFacturaDetalleDto {
  @IsString()
  @IsNotEmpty()
  facturaId: string;

  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto: number;
}

export class RegistrarPagoMultipleDto {
  @IsString()
  @IsNotEmpty()
  terceroId: string; // ClienteId o ProveedorId

  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsNumber()
  @IsNotEmpty()
  metodoPagoId: number;

  @IsOptional()
  @IsEnum(MedioPago, {
    message: 'medioPago debe ser: caja, banco, transferencia o cheque',
  })
  medioPago?: MedioPago;

  @IsOptional()
  @IsString()
  cuentaBancariaId?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoFacturaDetalleDto)
  detalles: PagoFacturaDetalleDto[];
}

export class PagoConceptoDetalleDto {
  @IsString()
  @IsNotEmpty()
  cuentaContableId: string;

  @IsString()
  @IsNotEmpty()
  concepto: string;

  @IsInt()
  @Min(1, { message: 'La cantidad debe ser mínimo 1' })
  cantidad: number;

  @IsNumber()
  @Min(0.01, { message: 'El valor unitario debe ser mayor a 0' })
  valorUnitario: number;

  @IsOptional()
  @IsString()
  impuestoId?: string;

  @IsOptional()
  @IsNumber()
  impuestoPorcentaje?: number;
}

export class RegistrarOtrosConceptosDto {
  @IsOptional()
  @IsString()
  terceroId?: string; // Opcional para otros ingresos/egresos

  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsNumber()
  @IsNotEmpty()
  metodoPagoId: number;

  @IsOptional()
  @IsEnum(MedioPago, {
    message: 'medioPago debe ser: caja, banco, transferencia o cheque',
  })
  medioPago?: MedioPago;

  @IsOptional()
  @IsString()
  cuentaBancariaId?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoConceptoDetalleDto)
  conceptos: PagoConceptoDetalleDto[];
}
