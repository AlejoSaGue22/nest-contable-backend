-- Opción B: agregar discriminador tipo a concepto_correccion.
-- Ejecutar una vez después de desplegar el cambio de entidad.
-- synchronize:true agrega la columna sola, pero este script cubre
-- backfill, unicidad compuesta y seeds de débito como red de seguridad.

-- 1. Columna tipo (idempotente)
ALTER TABLE "concepto_correccion" ADD COLUMN IF NOT EXISTS "tipo" varchar(10) NOT NULL DEFAULT 'credito';

-- 2. Backfill legacy -> credito
UPDATE "concepto_correccion" SET "tipo" = 'credito' WHERE "tipo" IS NULL OR "tipo" = '';

-- 3. Reemplazar UNIQUE(codigo) por UNIQUE(codigo, tipo)
-- Nombre autogenerado típico: UQ_<hash>. Se eliminan constraints únicas
-- que cubran solo (codigo) para permitir 1-4 en ambos tipos.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'concepto_correccion'::regclass AND contype = 'u'
  LOOP
    -- Conserva constraints que ya cubran (codigo, tipo); elimina las demás sobre codigo solo
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      JOIN unnest((SELECT conkey FROM pg_constraint WHERE conname = r.conname)) k ON k = a.attnum
      WHERE a.attrelid = 'concepto_correccion'::regclass AND a.attname = 'tipo'
    ) THEN
      EXECUTE format('ALTER TABLE "concepto_correccion" DROP CONSTRAINT %I', r.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE "concepto_correccion"
  ADD CONSTRAINT "UQ_concepto_correccion_codigo_tipo" UNIQUE ("codigo", "tipo");

-- 4. Seeds (red de seguridad; seedAll() también los inserta)
INSERT INTO "concepto_correccion" ("id", "codigo", "nombre", "tipo", "state")
SELECT gen_random_uuid(), x.codigo, x.nombre, x.tipo, true FROM (VALUES
  ('1','Devolución parcial de los bienes y/o no aceptación parcial del servicio','credito'),
  ('2','Anulación de factura electrónica','credito'),
  ('3','Rebaja o descuento parcial o total','credito'),
  ('4','Ajuste de precio','credito'),
  ('5','Descuento comercial por pronto pago','credito'),
  ('6','Descuento comercial por volumen de ventas','credito'),
  ('1','Intereses de mora','debito'),
  ('2','Gastos de cobranza','debito'),
  ('3','Ajuste de precio','debito'),
  ('4','Otros conceptos','debito')
) AS x(codigo, nombre, tipo)
WHERE NOT EXISTS (
  SELECT 1 FROM "concepto_correccion" c WHERE c."codigo" = x.codigo AND c."tipo" = x.tipo
);

-- 5. Verificación:
-- SELECT "tipo", "codigo", "nombre" FROM "concepto_correccion" ORDER BY "tipo", "codigo";
-- Debe retornar 6 filas credito + 4 filas debito.
