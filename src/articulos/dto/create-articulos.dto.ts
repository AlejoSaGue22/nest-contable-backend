import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateArticuloDto {

    @IsString()
    @IsNotEmpty()
    categoria: string

    @IsString()
    @IsNotEmpty()
    nombre: string

    @IsString()
    @IsOptional()
    codigo: string

    @IsString()
    @IsNotEmpty()
    unidadmedida: string

    @IsNumber()
    impuesto: number

    // @IsString()
    // retencion: string

    @Type(() => Number)
    @IsOptional()
    precio?: number

    @Type(() => Number)
    @IsOptional()
    precioventa2?: number

    @IsString()
    @IsOptional()
    observacion?: string

}

