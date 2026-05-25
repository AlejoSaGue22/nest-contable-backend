import { IsString, IsNotEmpty, IsOptional, IsBoolean } from "class-validator";
import { tipoCategoria } from "src/common/constants/categorias-articulos.config";

export class CreateCategoryArticleDto {

    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsString()
    @IsNotEmpty()
    tipo: tipoCategoria;

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