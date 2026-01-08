import { IsNotEmpty, IsString } from "class-validator";

export class CreateProductoDto {
    
    // id: string
    @IsString()
    @IsNotEmpty()
    categoria: string
    
    @IsString()
    @IsNotEmpty()
    nombre: string

    @IsString()
    @IsNotEmpty()
    codigo: string

    @IsString()
    @IsNotEmpty()
    unidadmedida: string

    @IsString()
    impuesto: string

    @IsString()
    retencion: string

    @IsString()
    @IsNotEmpty()
    precioventa1: string

    @IsString()
    precioventa2: string

    @IsString()
    observacion: string

}

