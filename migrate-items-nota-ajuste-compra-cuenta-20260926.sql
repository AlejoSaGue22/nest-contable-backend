-- NC compras: soportar gasto directo a cuenta contable en items_nota_ajuste_compra.
-- Ejecutar una vez después de desplegar el cambio de entidad.
-- synchronize:true agrega las columnas solas, pero este script es red de seguridad.

-- 1. Columnas (idempotentes)
ALTER TABLE "items_nota_ajuste_compra" ADD COLUMN IF NOT EXISTS "descripcion" text;
ALTER TABLE "items_nota_ajuste_compra" ADD COLUMN IF NOT EXISTS "cuentaContableId" uuid;

-- 2. FK a cuenta_contable (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_items_nota_ajuste_compra_cuentaContable'
  ) THEN
    ALTER TABLE "items_nota_ajuste_compra"
      ADD CONSTRAINT "FK_items_nota_ajuste_compra_cuentaContable"
      FOREIGN KEY ("cuentaContableId") REFERENCES "cuentas_contables"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- 3. Verificación:
-- SELECT "articuloId", "cuentaContableId", left("descripcion",40)
-- FROM "items_nota_ajuste_compra" LIMIT 10;
