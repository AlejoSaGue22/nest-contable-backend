import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveTipoExamenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  codigo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
