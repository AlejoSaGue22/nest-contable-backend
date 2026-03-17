import { IsOptional, IsString, IsEnum } from 'class-validator';
import { TipoCuenta } from '../entities/cuenta.entity';

export class FilterCuentaDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(TipoCuenta)
    tipo?: TipoCuenta;
}
