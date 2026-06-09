import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateClienteDto {

    @IsString()
    @IsOptional()
    @Transform(({ value }) => value === null ? '' : value)
    nombre?: string;

    @IsString()
    @IsOptional()
    @Transform(({ value }) => value === null ? '' : value)
    apellido?: string;

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
    @IsOptional()
    @Transform(({ value }) => value === null ? '' : value)
    razonSocial?: string;

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
    @IsOptional()
    @Transform(({ value }) => value === null ? '' : value)
    email: string;

    @IsString()
    @IsOptional()
    @Transform(({ value }) => value === null ? '' : value)
    observacion: string;

    @IsString()
    @IsNotEmpty()
    tributo: string;

}