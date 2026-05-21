import { IsString, IsNotEmpty, IsOptional, IsBoolean } from "class-validator";

export class CreateCategoryArticleDto {

    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsString()
    @IsNotEmpty()
    tipo: string;

    @IsString()
    @IsNotEmpty()
    cuentaPrincipalId: string;

    @IsString()
    @IsOptional()
    cuentaCostoId?: string;

    @IsString()
    @IsOptional()
    cuentaInventarioId?: string;

    @IsBoolean()
    @IsOptional()
    manejaInventario?: boolean;

    @IsString()
    @IsOptional()
    descripcion?: string;

}