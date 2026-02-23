import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { CreateFacturaCompraItemDto } from "./create-items-factura-compra.dto";

export class CreateFacturaCompraDto {

    @IsUUID()
    @IsNotEmpty()
    proveedorId: string;

    @IsDateString()
    @IsNotEmpty()
    fecha: string;

    @IsString()
    @IsOptional()
    observaciones?: string;

    @IsString()
    @IsNotEmpty()
    numero: string;

    @IsDateString()
    @IsOptional()
    fechaVencimiento?: string;

    @IsString()
    @IsNotEmpty()
    formaPago: string;

    @IsString()
    @IsOptional()
    metodoPago?: string;

    @IsArray()
    @IsNotEmpty()
    items: CreateFacturaCompraItemDto[];

    @IsNumber()
    @IsOptional()
    iva: number;

    @IsNumber()
    @IsOptional()
    descuento: number;

    @IsNumber()
    @IsOptional()
    subtotal: number;

    @IsNumber()
    @IsOptional()
    total: number;
}
