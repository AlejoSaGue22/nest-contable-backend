import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { CreateItemsFacturasVentaDto } from "./create-items-facturas-venta.dto";
import { Type } from "class-transformer";

export class CreateFacturasVentaDto {

    @IsUUID()
    @IsNotEmpty()
    clientId: string;

    // @IsString()
    // comprobante: string;

    // @IsString()
    // prefijo: string;

    @IsOptional()
    @IsString()
    vendedor: string;

    @IsString()
    @IsOptional()
    canalventa: string;

    @IsString()
    fecha: string;

    @IsString()
    @IsNotEmpty()
    formapago: string;

    @IsString()
    @IsOptional()
    metodoPago?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateItemsFacturasVentaDto)
    items: CreateItemsFacturasVentaDto[];

    @IsNumber()
    @IsOptional()
    iva: number;

    @IsNumber()
    @IsOptional()
    descuento: number;

    @IsNumber()
    @IsNotEmpty()
    subtotal: number;

    @IsNumber()
    @IsNotEmpty()
    total: number;


}


