-- Homologación EstadoNota a minúsculas (canon frontend).
-- Ejecutar una vez después de desplegar el cambio de enum.
-- Cubre valores legacy 'Borrador'/'Emitida'/'Enviada'/'Anulada'.

-- 1. Agregar nuevas etiquetas al enum Postgres (idempotente en PG >= 9.1 con IF NOT EXISTS en PG 12+).
-- Si tu versión no soporta IF NOT EXISTS, elimina esa cláusula y corre cada línea una vez.
ALTER TYPE "notas_ajuste_estado_enum" ADD VALUE IF NOT EXISTS 'borrador';
ALTER TYPE "notas_ajuste_estado_enum" ADD VALUE IF NOT EXISTS 'emitida';
ALTER TYPE "notas_ajuste_estado_enum" ADD VALUE IF NOT EXISTS 'enviada';
ALTER TYPE "notas_ajuste_estado_enum" ADD VALUE IF NOT EXISTS 'anulada';

-- 2. Migrar datos existentes al canon minúsculas.
UPDATE "notas_ajuste" SET "estado" = 'borrador' WHERE "estado" = 'Borrador';
UPDATE "notas_ajuste" SET "estado" = 'emitida' WHERE "estado" = 'Emitida';
UPDATE "notas_ajuste" SET "estado" = 'enviada' WHERE "estado" = 'Enviada';
UPDATE "notas_ajuste" SET "estado" = 'anulada' WHERE "estado" = 'Anulada';

-- 3. Verificación:
-- SELECT "estado", COUNT(*) FROM "notas_ajuste" GROUP BY "estado";
-- No deben quedar filas con 'Borrador'/'Emitida'/'Enviada'/'Anulada'.
