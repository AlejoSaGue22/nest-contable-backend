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
    @IsOptional()
    formaPago?: string;

    @IsArray()
    @IsNotEmpty()
    items: CreateFacturaCompraItemDto[];
}
