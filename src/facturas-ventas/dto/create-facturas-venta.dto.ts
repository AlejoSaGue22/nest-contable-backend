import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { CreateItemsFacturasVentaDto } from "./create-items-facturas-venta.dto";
import { Type } from "class-transformer";
import { FormaPago, TipoFactura } from "../entities/facturas-venta.entity";

export class CreateFacturasVentaDto {

    @IsUUID()
    @IsNotEmpty()
    clientId: string;

    @IsOptional()
    @IsString()
    prefijo?: string;

    @IsOptional()
    @IsString()
    vendedor?: string;

    @IsString()
    @IsNotEmpty()
    canalVenta: string;

    @IsString()
    @IsNotEmpty()
    fecha: string;

    @IsEnum(TipoFactura)
    @IsOptional()
    tipoFactura?: TipoFactura;

    @IsEnum(FormaPago)
    @IsNotEmpty()
    formaPago: FormaPago;

    @IsString()
    @IsOptional()
    metodoPago?: string;

    @IsString()
    @IsOptional()
    fechaVencimiento?: string;

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


