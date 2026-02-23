import { IsEmail, IsNotEmpty, IsNumber, IsString, MaxLength } from "class-validator";

export class CreateClienteDto {

    @IsString()
    // @IsNotEmpty()
    nombre: string;

    @IsString()
    // @IsNotEmpty()
    apellido: string;

    @IsString()
    @IsNotEmpty()
    tipoDocumento: string;

    @IsString()
    @IsNotEmpty()
    numeroDocumento: string;

    @IsString()
    @IsNotEmpty()
    tipoPersona: string;

    @IsString()
    // @IsNotEmpty()
    razonSocial: string;

    @IsString()
    @IsNotEmpty()
    direccion: string;

    @IsString()
    @IsNotEmpty()
    ciudad: string;

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