import { IsOptional, IsString } from 'class-validator';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

export class GetPeriodosFilterDto extends PaginatioDto {
  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  fecha?: string;
  
  @IsOptional()
  @IsString()
  anio?: string;
}
