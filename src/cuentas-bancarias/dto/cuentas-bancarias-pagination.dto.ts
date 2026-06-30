import { IsIn, IsOptional } from 'class-validator';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

export class CuentasBancariasPaginationDto extends PaginatioDto {
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'todos'])
  estado?: 'activo' | 'inactivo' | 'todos';
}
