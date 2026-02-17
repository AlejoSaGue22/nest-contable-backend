
import { IsOptional, IsDate, IsEnum, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus, InvoiceType } from '../entities/facturas-venta.entity';

export class InvoiceFilterDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

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
  offset?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 10;
}