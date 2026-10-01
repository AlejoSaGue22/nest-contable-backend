import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

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

    @IsString()
    @IsNotEmpty()
    impuesto: string

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

    @IsBoolean()
    @IsOptional()
    isInventariable?: boolean

}

