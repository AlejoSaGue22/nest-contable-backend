import { IsString, IsOptional, IsEmail, IsNotEmpty, IsObject, IsUUID, IsNumber } from 'class-validator';
import { ToOptionalNumber } from 'src/common/decorators/to-number.decorator';

export class CreateEmpresaDto {
  @IsString()
  @IsNotEmpty()
  nit: string;

  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsObject()
  configuracionDian?: any;

  @IsOptional()
  @IsUUID()
  arlId?: string;

  @IsOptional()
  @IsNumber()
  @ToOptionalNumber()
  ciudad?: number;
}
