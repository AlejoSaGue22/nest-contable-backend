import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { ToNumber, ToOptionalNumber } from "src/common/decorators/to-number.decorator";

export class CreateProveedorDto {
    @IsString()
    @IsOptional()
    dv?: string

    @IsString()
    @IsNotEmpty()
    tipoPersona: string;

    @IsString()
    @IsOptional() 
    razonSocial?: string;
    
    @IsNumber()
    @IsNotEmpty()
    @ToNumber()
    tipoDocumento: number;

    @IsString()
    @IsNotEmpty()
    identificacion: string;

    @IsString()
    @IsOptional()
    nombre?: string;

    @IsString()
    @IsOptional()
    apellido?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    telefono?: string;

    @IsString()
    @IsOptional()
    direccion?: string;

    @IsNumber()
    @IsOptional()
    @ToOptionalNumber()
    ciudad?: number;

    @IsString()
    @IsOptional()
    nombreContacto?: string;

    @IsString()
    @IsOptional()
    telefonoContacto?: string;

    @IsString()
    @IsOptional()
    observaciones?: string;

    @IsUUID()
    @IsOptional()
    cuentaContableId?: string;

    // @IsBoolean()
    // @IsOptional()
    // isActive?: boolean;
}
