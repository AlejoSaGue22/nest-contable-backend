import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateCategoryArticleDto {

    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsString()
    @IsNotEmpty()
    tipo: string;

    @IsString()
    @IsNotEmpty()
    cuentaContable: string;

    @IsString()
    @IsNotEmpty()
    cuentaIva: string;

    @IsString()
    @IsOptional()
    descripcion?: string;

}