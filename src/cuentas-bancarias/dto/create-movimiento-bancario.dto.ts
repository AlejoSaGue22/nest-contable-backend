import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ToNumber } from 'src/common/decorators/to-number.decorator';

export enum TipoMovimientoBancario {
  INGRESO = 'ingreso',
  EGRESO = 'egreso',
}

export class CreateMovimientoBancarioDto {
  @IsEnum(TipoMovimientoBancario)
  @IsNotEmpty()
  tipo: TipoMovimientoBancario;

  @IsNumber()
  @Min(0.01)
  @ToNumber()
  monto: number;

  @IsString()
  @IsNotEmpty()
  cuentaContrapartidaCodigo: string;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
