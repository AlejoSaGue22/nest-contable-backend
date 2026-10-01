import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AssignPeriodoEmpleadosDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  empleadoIds: string[];

  @IsNumber()
  @Min(1)
  @IsOptional()
  diasNovedad?: number;
}
