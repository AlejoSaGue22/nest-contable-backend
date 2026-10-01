import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateFacturaCompraItemDto {

    @IsString()
    @IsOptional()
    descripcion?: string;

    @IsUUID()
    @IsOptional()
    articuloId?: string;

    @IsUUID()
    @IsOptional()
    cuentaContableId?: string;

    @IsNumber()
    @IsNotEmpty()
    unitPrice: number;

    @IsNumber()
    @IsOptional()
    iva: number;

    @IsString()
    @IsOptional()
    impuestoId?: string;

    @IsNumber()
    @IsOptional()
    discount: number;

    @IsNumber()
    @IsNotEmpty()
    quantity: number; // Cantidad

    @IsNumber()
    @IsOptional()
    importe?: number;
}