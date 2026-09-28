import { Transform, TransformFnParams } from 'class-transformer';

function toNumberOrOriginal(value: unknown): number | unknown {
  if (value === null || value === undefined || value === '') return value;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
}

/**
 * SRP: única responsabilidad de coercionar IDs numéricos que llegan
 * como string (ej. "08421", "6") a number antes de la validación.
 * DRY: evita duplicar el lambda @Transform en cada DTO.
 *
 * Uso para campos requeridos: deja ''/null/undefined intactos para
 * que @IsNotEmpty/@IsNumber reporten el error correspondiente.
 */
export function ToNumber(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => toNumberOrOriginal(value));
}

/**
 * Variante para campos opcionales: normaliza ''/null/undefined a
 * undefined para que @IsOptional los omita correctamente.
 */
export function ToOptionalNumber(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => {
    if (value === null || value === undefined || value === '') return undefined;
    return toNumberOrOriginal(value);
  });
}
