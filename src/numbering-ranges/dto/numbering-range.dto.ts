import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { NumberingRangeDomain } from '../entities/factus-numbering-range.entity';

export class ListNumberingRangesDto {
  @IsOptional()
  @IsIn(['billing', 'payroll'])
  domain?: NumberingRangeDomain;

  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class SyncNumberingRangesDto {
  @IsOptional()
  @IsIn(['billing', 'payroll'])
  domain?: NumberingRangeDomain;
}

/**
 * Creación proxy: el payload se reenvía tal cual a Factus
 * (POST /v2/numbering-ranges), pues el esquema lo define el proveedor.
 */
export class CreateNumberingRangeDto {
  @IsOptional()
  @IsIn(['billing', 'payroll'])
  domain?: NumberingRangeDomain;

  @IsObject()
  payload: Record<string, unknown>;
}

export class UpdateRangeCurrentDto {
  @IsOptional()
  @IsIn(['billing', 'payroll'])
  domain?: NumberingRangeDomain;

  /** Se reenvía a PATCH /v2/numbering-ranges/:id/current */
  @IsInt()
  current: number;
}

export class RangeDomainQueryDto {
  @IsOptional()
  @IsIn(['billing', 'payroll'])
  domain?: NumberingRangeDomain;
}
