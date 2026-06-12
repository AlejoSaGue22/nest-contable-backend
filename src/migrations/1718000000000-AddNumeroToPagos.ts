import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNumeroToPagos1718000000000 implements MigrationInterface {
  name = 'AddNumeroToPagos1718000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pagos" ADD "numero" character varying(20) NOT NULL DEFAULT ''`,
    );

    // Backfill: assign sequential numbers to existing records
    // COB = cobros (facturaVentaId IS NOT NULL)
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
        FROM "pagos"
        WHERE "facturaVentaId" IS NOT NULL
      )
      UPDATE "pagos"
      SET "numero" = 'COB-' || LPAD(numbered.rn::text, 4, '0')
      FROM numbered
      WHERE "pagos".id = numbered.id
    `);

    // PAG = pagos (facturaCompraId IS NOT NULL)
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
        FROM "pagos"
        WHERE "facturaCompraId" IS NOT NULL
      )
      UPDATE "pagos"
      SET "numero" = 'PAG-' || LPAD(numbered.rn::text, 4, '0')
      FROM numbered
      WHERE "pagos".id = numbered.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pagos" DROP COLUMN "numero"`);
  }
}
