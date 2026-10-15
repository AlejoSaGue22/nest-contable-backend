import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFinanciadorasToFacturasVenta1720000000002 implements MigrationInterface {
  name = 'AddFinanciadorasToFacturasVenta1720000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "financiadoras" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(150) NOT NULL,
        "nit" character varying(30),
        "activo" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_financiadoras" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_financiadoras_nombre" UNIQUE ("nombre")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "financiadoras" ("nombre") VALUES ('Sistecrédito')
      ON CONFLICT ("nombre") DO NOTHING
    `);
    await queryRunner.query(`
      ALTER TABLE "facturas_venta"
      ADD COLUMN IF NOT EXISTS "esFinanciacionExterna" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "financiadoraId" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_facturas_venta_financiadora') THEN
          ALTER TABLE "facturas_venta"
          ADD CONSTRAINT "FK_facturas_venta_financiadora"
          FOREIGN KEY ("financiadoraId") REFERENCES "financiadoras"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_facturas_venta_financiadora" ON "facturas_venta" ("financiadoraId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_facturas_venta_financiadora"`);
    await queryRunner.query(`ALTER TABLE "facturas_venta" DROP CONSTRAINT IF EXISTS "FK_facturas_venta_financiadora"`);
    await queryRunner.query(`ALTER TABLE "facturas_venta" DROP COLUMN IF EXISTS "financiadoraId"`);
    await queryRunner.query(`ALTER TABLE "facturas_venta" DROP COLUMN IF EXISTS "esFinanciacionExterna"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "financiadoras"`);
  }
}
