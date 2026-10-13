import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TipoLentePrescripcion } from '../entities/prescripcion.entity';

export class CreatePrescripcionDto {
  @IsDateString()
  fechaExamen: string;

  @IsUUID()
  clienteId: string;

  @IsUUID()
  @IsOptional()
  profesionalId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  tipoExamen?: string;

  @IsEnum(TipoLentePrescripcion)
  tipoLente: TipoLentePrescripcion;

  @IsObject()
  @Type(() => Object)
  ojoDerecho: Record<string, unknown>;

  @IsObject()
  @Type(() => Object)
  ojoIzquierdo: Record<string, unknown>;

  @IsObject()
  @Type(() => Object)
  @IsOptional()
  lensometria?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  datosContacto?: Record<string, unknown>;

  @IsString() @IsOptional() usoIndicado?: string;
  @IsString() @IsOptional() material?: string;
  @IsString() @IsOptional() filtroTratamiento?: string;
  @IsString() @IsOptional() tipoLenteDescripcion?: string;
  @IsDateString() @IsOptional() fechaControl?: string;
  @IsString() @IsOptional() indicaciones?: string;
  @IsString() @IsOptional() observaciones?: string;
  @IsString() @IsOptional() recomendaciones?: string;
}
