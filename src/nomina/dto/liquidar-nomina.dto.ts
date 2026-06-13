import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class HorasExtraInput {
    @IsString()
    tipo: string;

    @IsNumber()
    @Min(0)
    cantidad: number;

    @IsNumber()
    @Min(0)
    valor: number;
}

class BonificacionInput {
    @IsString()
    concepto: string;

    @IsNumber()
    @Min(0)
    valor: number;

    @IsOptional()
    salarial?: boolean;
}

class OtraDeduccionInput {
    @IsString()
    concepto: string;

    @IsNumber()
    @Min(0)
    valor: number;
}

class LiquidacionEmpleadoInput {
    @IsString()
    empleadoId: string;

    @IsNumber()
    @Min(0)
    diasTrabajados: number;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => HorasExtraInput)
    horasExtras?: HorasExtraInput[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => BonificacionInput)
    bonificaciones?: BonificacionInput[];

    @IsNumber()
    @IsOptional()
    @Min(0)
    comisiones?: number;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => OtraDeduccionInput)
    otrasDeducciones?: OtraDeduccionInput[];
}

export class LiquidarNominaDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LiquidacionEmpleadoInput)
    @ArrayMinSize(1)
    empleados: LiquidacionEmpleadoInput[];
}
