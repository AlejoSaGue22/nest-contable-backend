import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ToNumber } from 'src/common/decorators/to-number.decorator';

export class CreateTransferenciaDto {
  @IsUUID()
  @IsNotEmpty()
  cuentaOrigenId: string;

  @IsUUID()
  @IsNotEmpty()
  cuentaDestinoId: string;

  @IsNumber()
  @Min(0.01)
  @ToNumber()
  monto: number;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
