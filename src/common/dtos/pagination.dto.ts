import { Type } from "class-transformer";
import { IsOptional, IsPositive, Min, IsString } from "class-validator";

export class PaginatioDto {

    @IsPositive()
    @IsOptional()
    @Type(() => Number)
    limit?: number;

    @IsOptional()
    @Min(0)
    @Type(() => Number)
    offset?: number;

    @IsString()
    @IsOptional()
    venta_compra?: 'venta' | 'costo';

    @IsString()
    @IsOptional()
    search?: string;

}