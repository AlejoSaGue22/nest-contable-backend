import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateBancoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  codigo?: string;

  @IsString()
  @IsOptional()
  nit?: string;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;
}
