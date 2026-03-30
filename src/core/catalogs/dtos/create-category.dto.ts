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
    cuentaContableId: string;

    @IsString()
    @IsNotEmpty()
    cuentaIvaId: string;

    @IsString()
    @IsOptional()
    descripcion?: string;

}