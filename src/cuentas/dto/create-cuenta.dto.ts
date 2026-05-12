import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCuentaDto {
    @IsString()
    @IsNotEmpty()
    codigo: string;

    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsString()
    @IsOptional()
    descripcion?: string;

    @IsBoolean()
    @IsOptional()
    aceptaMovimiento?: boolean;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
