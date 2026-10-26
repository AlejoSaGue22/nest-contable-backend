import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddArticuloSearchTrigramIndex1720000000005 implements MigrationInterface {
  name = 'AddArticuloSearchTrigramIndex1720000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_articulos_busqueda_trgm"
      ON "articulos" USING GIN (
        TRANSLATE(LOWER(COALESCE(
          COALESCE("nombre", '') || CHR(1) || COALESCE("codigo", ''),
          ''
        )), 'áéíóúüñ', 'aeiouun') gin_trgm_ops
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_articulos_busqueda_trgm"`);
  }
}
