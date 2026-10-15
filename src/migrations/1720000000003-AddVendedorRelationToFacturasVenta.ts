import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVendedorRelationToFacturasVenta1720000000003 implements MigrationInterface {
  name = 'AddVendedorRelationToFacturasVenta1720000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Convertir columna 'vendedor' a uuid de forma segura
    await queryRunner.query(`
      ALTER TABLE "facturas_venta"
      ALTER COLUMN "vendedor" TYPE uuid
      USING (
        CASE
          WHEN "vendedor"::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN "vendedor"::uuid
          ELSE NULL
        END
      )
    `);

    // 2. Limpiar registros huérfanos si existieran
    await queryRunner.query(`
      UPDATE "facturas_venta"
      SET "vendedor" = NULL
      WHERE "vendedor" IS NOT NULL
        AND "vendedor" NOT IN (SELECT "id" FROM "vendedores")
    `);

    // 3. Crear índice para optimizar consultas y joins
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_facturas_venta_vendedor"
      ON "facturas_venta" ("vendedor")
    `);

    // 4. Agregar llave foránea hacia la tabla vendedores
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_facturas_venta_vendedor') THEN
          ALTER TABLE "facturas_venta"
          ADD CONSTRAINT "FK_facturas_venta_vendedor"
          FOREIGN KEY ("vendedor") REFERENCES "vendedores"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "facturas_venta"
      DROP CONSTRAINT IF EXISTS "FK_facturas_venta_vendedor"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_facturas_venta_vendedor"
    `);
    await queryRunner.query(`
      ALTER TABLE "facturas_venta"
      ALTER COLUMN "vendedor" TYPE character varying(255)
    `);
  }
}
