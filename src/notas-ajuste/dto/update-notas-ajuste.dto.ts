import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { CreateItemNotaAjusteDto } from './create-items-notas-ajuste.dto';
import { Type } from 'class-transformer';

export class UpdateNotasAjusteDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  motivo?: string;
 
  @IsString()
  @IsOptional()
  fecha?: string;
 
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemNotaAjusteDto)
  @IsOptional()
  items?: CreateItemNotaAjusteDto[];
 
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  observaciones?: string;
}
