import { IsOptional, IsString, IsEnum, IsDate } from 'class-validator';
import { TipoCuenta } from '../entities/cuenta.entity';

export class FilterCuentaDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(TipoCuenta)
    tipo?: TipoCuenta;

    @IsOptional()
    @IsString()
    fechaInicio?: string;

    @IsOptional()
    @IsString()
    fechaFin?: string;
}
