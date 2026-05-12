import { PartialType } from '@nestjs/mapped-types';
import { CreateCuentaDto } from './create-cuenta.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCuentaDto extends PartialType(CreateCuentaDto) {
    @IsString()
    @IsOptional()
    nombre?: string;

    @IsString()
    @IsOptional()
    descripcion?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
