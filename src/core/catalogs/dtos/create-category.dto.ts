import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from "class-validator";
import { TipoCategoria } from "src/common/constants/categorias-articulos.config";

export class CreateCategoryArticleDto {

    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsEnum(TipoCategoria, { message: 'El tipo de categoría debe ser VENTA, COSTO, GASTO o SERVICIO' })
    @IsNotEmpty()
    tipo: TipoCategoria;

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