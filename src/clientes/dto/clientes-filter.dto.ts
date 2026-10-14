import { IsIn, IsOptional } from 'class-validator';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

export class ClientesFilterDto extends PaginatioDto {
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: 'ACTIVO' | 'INACTIVO';
}
