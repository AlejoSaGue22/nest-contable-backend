import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateCargoDto {
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
