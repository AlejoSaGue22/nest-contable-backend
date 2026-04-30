
import { IsOptional, IsDate, IsEnum, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { DianStatus, InvoiceStatus, TipoFactura } from '../enums/factura-venta.enum';

export class InvoiceFilterDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  noStatus?: string;

  @IsOptional()
  @IsEnum(TipoFactura)
  tipoFactura?: TipoFactura;

  @IsOptional()
  @IsString()
  numeroFactura?: string;

  @IsOptional()
  @IsEnum(DianStatus)
  dianStatus?: DianStatus;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  providerName?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10;
}