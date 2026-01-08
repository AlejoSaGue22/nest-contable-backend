import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateItemsFacturasVentaDto {

    @IsUUID()
    @IsNotEmpty()
    productoId: string;

    @IsString()
    @IsOptional()
    description: string

    @IsNumber()
    @IsNotEmpty()
    unitPrice: number;

    @IsNumber()
    @IsOptional()
    iva: number;

    @IsNumber()
    @IsOptional()
    discount: number;

    @IsNumber()
    @IsNotEmpty()
    quantity: number; // Cantidad

    @IsNumber()
    @IsNotEmpty()
    importe: number;

    // @IsNumber()
    // @IsNotEmpty()
    // total: number;

    // @IsNumber()
    // @IsNotEmpty()
    // subtotal: number;

    // @IsString()
    // @IsNotEmpty()
    // facturaId: string

}