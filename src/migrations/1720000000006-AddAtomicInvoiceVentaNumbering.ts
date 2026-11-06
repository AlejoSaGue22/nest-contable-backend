import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAtomicInvoiceVentaNumbering1720000000006 implements MigrationInterface {
  name = 'AddAtomicInvoiceVentaNumbering1720000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = await queryRunner.query(`
      SELECT "prefijo", "comprobante", ARRAY_AGG("id"::text ORDER BY "createdAt") AS "ids"
      FROM "facturas_venta"
      WHERE "prefijo" IS NOT NULL
        AND "prefijo" <> ''
        AND "comprobante" IS NOT NULL
        AND "comprobante" <> ''
      GROUP BY "prefijo", "comprobante"
      HAVING COUNT(*) > 1
      ORDER BY "prefijo", "comprobante"
      LIMIT 20
    `);

    if (duplicates.length > 0) {
      const details = duplicates
        .map((duplicate: { prefijo: string; comprobante: string; ids: string[] }) =>
          `${duplicate.prefijo}-${duplicate.comprobante} (IDs: ${duplicate.ids.join(', ')})`,
        )
        .join('; ');
      throw new Error(
        `No se puede activar la numeración única: existen comprobantes duplicados. ` +
        `Concilie esos documentos y sus pagos/asientos antes de ejecutar esta migración: ${details}`,
      );
    }

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS "facturas_venta_comprobante_seq" AS BIGINT START WITH 1
    `);

    await queryRunner.query(`
      SELECT setval(
        '"facturas_venta_comprobante_seq"',
        GREATEST(COALESCE(MAX("comprobante"::BIGINT), 0), 1),
        COALESCE(MAX("comprobante"::BIGINT), 0) > 0
      )
      FROM "facturas_venta"
      WHERE "comprobante" ~ '^[0-9]+$'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_facturas_venta_prefijo_comprobante"
      ON "facturas_venta" ("prefijo", "comprobante")
      WHERE "prefijo" IS NOT NULL
        AND "prefijo" <> ''
        AND "comprobante" IS NOT NULL
        AND "comprobante" <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_facturas_venta_prefijo_comprobante"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "facturas_venta_comprobante_seq"`);
  }
}
