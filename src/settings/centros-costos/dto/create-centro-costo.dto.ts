import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateCentroCostoDto {
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
    activo?: boolean;
}
