import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateClienteDto {

    @IsString()
    // @IsNotEmpty()
    nombre: string;

    @IsString()
    // @IsNotEmpty()
    apellido: string;

    @IsNumber()
    @IsNotEmpty()
    tipoDocumento: number;

    @IsString()
    @IsNotEmpty()
    numeroDocumento: string;

    @IsString()
    @IsOptional()
    dv?: string

    @IsString()
    @IsNotEmpty()
    tipoPersona: string;

    @IsString()
    // @IsNotEmpty() 
    razonSocial: string;

    @IsString()
    @IsNotEmpty()
    direccion: string;

    @IsNumber()
    @IsNotEmpty()
    ciudad: number;

    @IsString()
    @MaxLength(10)
    @IsNotEmpty()
    telefono: string;

    @IsEmail()
    email: string;

    @IsString()
    observacion: string;

    @IsString()
    @IsNotEmpty()
    tributo: string;

    @IsString()
    @IsNotEmpty()
    responsableFiscal: string;

}