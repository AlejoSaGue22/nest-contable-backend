import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveProfesionalResponsableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  especialidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registroProfesional?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
