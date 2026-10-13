import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class PrescripcionFilterDto {
  @IsOptional()
  @Transform(({ value }) => (!value || value === 'undefined' ? undefined : String(value).trim()))
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (!value || value === 'undefined' ? undefined : value))
  @IsDateString({}, { message: 'desde: debe ser una fecha válida con formato AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @Transform(({ value }) => (!value || value === 'undefined' ? undefined : value))
  @IsDateString({}, { message: 'hasta: debe ser una fecha válida con formato AAAA-MM-DD' })
  hasta?: string;

  @IsOptional()
  @Transform(({ value }) => (!value || value === 'undefined' ? undefined : value))
  @IsUUID()
  profesionalId?: string;

  @IsOptional()
  @Transform(({ value }) => (value && value !== 'undefined' ? Number(value) : undefined))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value && value !== 'undefined' ? Number(value) : undefined))
  limit?: number;
}
