import { IsNumber, Min, Max } from 'class-validator';

export class DepreciarPeriodoDto {
  @IsNumber()
  @Min(2000)
  anio: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  mes: number;
}
