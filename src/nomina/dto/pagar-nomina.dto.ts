import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PagarNominaDto {
    @IsDateString()
    @IsNotEmpty()
    fechaPago: Date;

    @IsString()
    @IsNotEmpty()
    cuentaCodigoContable: string;

    @IsOptional()
    @IsString()
    bancoId?: string;

    @IsOptional()
    @IsString()
    numeroComprobante?: string;

    @IsOptional()
    @IsString()
    observaciones?: string;
}
