import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { MedioPago } from '../enums/pago.enum';

/**
 * DTO para registrar un PAGO sobre una factura de compra a crédito.
 * Usado en POST /cxp/:facturaCompraId/pago
 * Idéntico a RegistrarCobroDto — se separa para poder extenderse independientemente.
 */
export class RegistrarPagoDto {
  @IsInt()
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @IsEnum(MedioPago, {
    message: 'medioPago debe ser: caja, banco, transferencia o cheque',
  })
  medioPago: MedioPago;

  @IsOptional()
  @IsNumber()
  metodoPagoId?: number;

  @IsOptional()
  @IsString()
  cuentaBancariaId?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

/**
 * DTO para registrar un COBRO sobre una factura de venta a crédito.
 * Usado en POST /cxc/:facturaVentaId/cobro
 */
export class RegistrarCobroDto {
  @IsInt()
  @Min(1, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @IsDateString()
  @IsNotEmpty()
  fecha: string; // 'YYYY-MM-DD'

  @IsEnum(MedioPago, {
    message: 'medioPago debe ser: caja, banco, transferencia o cheque',
  })
  medioPago: MedioPago;

  @IsOptional()
  @IsNumber()
  metodoPagoId?: number;

  /**
   * Requerido cuando medioPago != 'caja'.
   * ID de la cuenta bancaria donde ingresó el dinero.
   */
  @IsOptional()
  @IsString()
  cuentaBancariaId?: string;

  /** Número de transferencia, cheque, voucher, etc. */
  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

