import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFinanciadoraDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  nit?: string;
}
