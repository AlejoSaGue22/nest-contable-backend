import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class AplicarAnticipoDto {
  @IsUUID()
  @IsNotEmpty()
  anticipoId: string;

  @IsNumber()
  @Min(0.01, { message: 'El monto a aplicar debe ser mayor a 0' })
  montoAplicado: number;
}
