import { IsOptional, IsString } from 'class-validator';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

export class GetEmpleadosFilterDto extends PaginatioDto {
  @IsOptional()
  @IsString()
  activo?: string;

  @IsOptional()
  @IsString()
  cargoId?: string;
}
