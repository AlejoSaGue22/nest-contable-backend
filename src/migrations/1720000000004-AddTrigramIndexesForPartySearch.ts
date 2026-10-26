import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrigramIndexesForPartySearch1720000000004 implements MigrationInterface {
  name = 'AddTrigramIndexesForPartySearch1720000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_clientes_busqueda_trgm"
      ON "clientes" USING GIN (
        TRANSLATE(LOWER(COALESCE(
          COALESCE("nombre", '') || ' ' || COALESCE("apellido", '') || CHR(1) ||
          COALESCE("razonSocial", '') || CHR(1) ||
          COALESCE("numeroDocumento", '') || CHR(1) ||
          COALESCE("dv", '') || CHR(1) ||
          REGEXP_REPLACE(COALESCE("numeroDocumento", ''), '[^0-9]', '', 'g'),
          ''
        )), 'áéíóúüñ', 'aeiouun') gin_trgm_ops
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_proveedores_busqueda_trgm"
      ON "proveedores" USING GIN (
        TRANSLATE(LOWER(COALESCE(
          COALESCE("nombre", '') || ' ' || COALESCE("apellido", '') || CHR(1) ||
          COALESCE("razonSocial", '') || CHR(1) ||
          COALESCE("identificacion", '') || CHR(1) ||
          COALESCE("dv", '') || CHR(1) ||
          REGEXP_REPLACE(COALESCE("identificacion", ''), '[^0-9]', '', 'g') || CHR(1) ||
          COALESCE("email", '') || CHR(1) ||
          COALESCE("telefono", ''),
          ''
        )), 'áéíóúüñ', 'aeiouun') gin_trgm_ops
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_proveedores_busqueda_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_clientes_busqueda_trgm"`);
  }
}
