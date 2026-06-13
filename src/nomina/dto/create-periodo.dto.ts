import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { TipoPeriodoNomina } from '../enums/tipo-periodo.enum';

export class CreatePeriodoDto {
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsDateString()
    @IsNotEmpty()
    fechaInicio: string;

    @IsDateString()
    @IsNotEmpty()
    fechaFin: string;

    @IsEnum(TipoPeriodoNomina)
    @IsNotEmpty()
    tipo: TipoPeriodoNomina;

    @IsDateString()
    @IsOptional()
    fechaPago?: string;
}
