import { IsDateString, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ObligacionPagoDetalleDto {
    @IsString()
    @IsNotEmpty()
    obligacionId: string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0.01)
    valorAbono: number;
}

export class PagarObligacionesDto {
    @IsString()
    @IsNotEmpty()
    periodoId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ObligacionPagoDetalleDto)
    detalles: ObligacionPagoDetalleDto[];

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
