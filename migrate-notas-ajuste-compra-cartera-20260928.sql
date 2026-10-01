-- NC compras: idempotencia de cartera espejo de ventas (Fase 2 compras).
-- Ejecutar una vez después de desplegar el cambio de entidad.
-- synchronize:true agrega las columnas solas; este script es red de seguridad.
-- Filas existentes quedan con saldoAplicado=false → reversa legacy directa.

-- 1. Columnas (idempotentes)
ALTER TABLE "notas_ajuste_compras" ADD COLUMN IF NOT EXISTS "saldoAplicado" boolean NOT NULL DEFAULT false;
ALTER TABLE "notas_ajuste_compras" ADD COLUMN IF NOT EXISTS "valorAplicadoCartera" numeric(15,2);

-- 2. Verificación:
-- SELECT "numeroCompleto", "estado", "saldoAplicado", "valorAplicadoCartera"
-- FROM "notas_ajuste_compras" ORDER BY "createdAt" DESC LIMIT 10;
