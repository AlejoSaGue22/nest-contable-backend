import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

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

    // @IsBoolean()
    // @IsOptional()
    // isActive?: boolean;
}
