import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TipoConceptoNomina } from '../enums/tipo-concepto.enum';
import { CategoriaConceptoNomina } from '../enums/categoria-concepto.enum';

export class CreateConceptoDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(TipoConceptoNomina)
  tipo: TipoConceptoNomina;

  @IsEnum(CategoriaConceptoNomina)
  categoria: CategoriaConceptoNomina;

  @IsBoolean()
  @IsOptional()
  aplicaIbc?: boolean;

  @IsBoolean()
  @IsOptional()
  aplicaPrestaciones?: boolean;

  @IsString()
  @IsOptional()
  cuentaContableDebito?: string;

  @IsString()
  @IsOptional()
  cuentaContableCredito?: string;
}
