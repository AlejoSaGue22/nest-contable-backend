import { IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { CreateDocumentoSoporteItemDto } from "./create-documento-soporte-item.dto";
import { FormaPago } from "src/facturas-ventas/enums/factura-venta.enum";
import { TipoDocumentoSoporte } from "../entities/documento-soporte.entity";
import { Type } from "class-transformer";
import { AplicarAnticipoDto } from "src/pagos/dto/aplicar-anticipo.dto";

export class CreateDocumentoSoporteDto {

    @IsUUID()
    @IsNotEmpty()
    proveedorId: string;

    @IsEnum(TipoDocumentoSoporte)
    @IsOptional()
    tipo?: TipoDocumentoSoporte;

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

    /** '1' por operación | '2' acumulado semanal */
    @IsIn(['1', '2'])
    @IsOptional()
    generationMode?: string;

    /** Requerida si generationMode = '2' (YYYY-MM-DD, máx. 6 días atrás). */
    @IsDateString()
    @IsOptional()
    periodStartDate?: string;

    @IsArray()
    @IsNotEmpty()
    items: CreateDocumentoSoporteItemDto[];

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

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AplicarAnticipoDto)
    anticiposAsociados?: AplicarAnticipoDto[];
}
