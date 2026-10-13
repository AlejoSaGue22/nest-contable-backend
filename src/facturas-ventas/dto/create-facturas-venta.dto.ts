import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested, Min, IsDateString } from "class-validator";
import { CreateItemsFacturasVentaDto } from "./create-items-facturas-venta.dto";
import { Type } from "class-transformer";
import { FormaPago, TipoFactura } from "../enums/factura-venta.enum";
import { AplicarAnticipoDto } from "src/pagos/dto/aplicar-anticipo.dto";
import { MedioPago } from "src/pagos/enums/pago.enum";

export class AbonoInicialFacturaDto {
    @IsNumber()
    @Min(0.01, { message: 'El abono debe ser mayor que cero' })
    monto: number;

    @IsDateString()
    @IsOptional()
    fecha?: string;

    @IsEnum(MedioPago)
    medioPago: MedioPago;

    @IsNumber()
    @IsOptional()
    metodoPagoId?: number;

    @IsUUID()
    @IsOptional()
    cuentaBancariaId?: string;

    @IsString()
    @IsOptional()
    referencia?: string;

    @IsString()
    @IsOptional()
    notas?: string;
}

export class CreateFacturasVentaDto {

    @IsUUID()
    @IsNotEmpty()
    clientId: string;

    @IsOptional()
    @IsString()
    vendedor?: string;

    @IsNumber()
    @IsNotEmpty()
    canalVenta: number;

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

    @IsUUID()
    @IsOptional()
    cuentaBancariaId?: string;

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

    @IsBoolean()
    @IsOptional()
    saveAsDraft?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AplicarAnticipoDto)
    anticiposAsociados?: AplicarAnticipoDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AbonoInicialFacturaDto)
    abonosIniciales?: AbonoInicialFacturaDto[];
}


