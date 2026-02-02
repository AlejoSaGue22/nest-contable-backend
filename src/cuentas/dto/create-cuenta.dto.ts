import { IsNotEmpty, IsString } from "class-validator";

export class CreateCuentaDto {
    @IsString()
    @IsNotEmpty()
    codigo: string

    @IsString()
    @IsNotEmpty()
    nombre: string

    @IsString()
    @IsNotEmpty()
    tipo: string

    @IsString()
    @IsNotEmpty()
    naturaleza: string

    @IsString()
    @IsNotEmpty()
    balance: string

    @IsString()
    @IsNotEmpty()
    isActive: boolean
}
