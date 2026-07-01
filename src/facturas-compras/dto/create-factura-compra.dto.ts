import { IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { CreateFacturaCompraItemDto } from "./create-items-factura-compra.dto";
import { FormaPago } from "src/facturas-ventas/enums/factura-venta.enum";

export class CreateFacturaCompraDto {

    @IsUUID()
    @IsNotEmpty()
    proveedorId: string;

    @IsString()
    @IsNotEmpty()
    fecha: string;

    @IsString()
    @IsOptional()
    observaciones?: string;

    @IsString()
    @IsNotEmpty()
    numeroFacturaProveedor: string;

    @IsString()
    @IsOptional()
    fechaVencimiento?: string;

    @IsEnum(FormaPago)
    @IsNotEmpty()
    formaPago: FormaPago;

    @IsString()
    @IsOptional()
    metodoPago?: string;

    @IsOptional()
    @IsString()
    cuentaBancariaId?: string;

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

    @IsBoolean()
    @IsOptional()
    isDraft?: boolean;
}
