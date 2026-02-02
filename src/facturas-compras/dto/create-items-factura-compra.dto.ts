import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateFacturaCompraItemDto {
    @IsString()
    @IsOptional()
    id?: string;

    @IsString()
    @IsOptional()
    descripcion?: string;

    @IsUUID()
    @IsOptional()
    articuloId?: string;

    @IsNumber()
    @IsNotEmpty()
    valor: number;

    @IsNumber()
    @IsOptional()
    porcentajeIva?: number;

    @IsNumber()
    @IsOptional()
    valorIva?: number;
}