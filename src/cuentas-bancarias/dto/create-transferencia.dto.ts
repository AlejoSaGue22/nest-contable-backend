import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTransferenciaDto {
  @IsUUID()
  @IsNotEmpty()
  cuentaOrigenId: string;

  @IsUUID()
  @IsNotEmpty()
  cuentaDestinoId: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsString()
  @IsOptional()
  observaciones?: string;
}
