import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAtomicNumberingCounters1720000000007 implements MigrationInterface {
  name = 'CreateAtomicNumberingCounters1720000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicateChecks = [
      {
        series: 'facturas_compras.numero',
        sql: `SELECT "numero", ARRAY_AGG("id"::text) AS "ids" FROM "facturas_compras"
              WHERE "numero" IS NOT NULL AND "numero" <> ''
              GROUP BY "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
      {
        series: 'documentos_soporte.numero',
        sql: `SELECT "numero", ARRAY_AGG("id"::text) AS "ids" FROM "documentos_soporte"
              WHERE "numero" IS NOT NULL AND "numero" <> ''
              GROUP BY "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
      {
        series: 'pagos.numero',
        sql: `SELECT "numero", ARRAY_AGG("id"::text) AS "ids" FROM "pagos"
              WHERE "numero" ~ '^(RC|CE|COB|PAG)-[0-9]+$'
              GROUP BY "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
      {
        series: 'asientos_contables.numero',
        sql: `SELECT "numero", ARRAY_AGG("id"::text) AS "ids" FROM "asientos_contables"
              WHERE "numero" IS NOT NULL AND "numero" <> ''
              GROUP BY "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
      {
        series: 'notas_ajuste(prefijo, numero)',
        sql: `SELECT "prefijo", "numero", ARRAY_AGG("id"::text) AS "ids" FROM "notas_ajuste"
              WHERE "prefijo" IS NOT NULL AND "prefijo" <> '' AND "numero" IS NOT NULL AND "numero" <> ''
              GROUP BY "prefijo", "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
      {
        series: 'notas_ajuste_compras(prefijo, numero)',
        sql: `SELECT "prefijo", "numero", ARRAY_AGG("id"::text) AS "ids" FROM "notas_ajuste_compras"
              WHERE "prefijo" IS NOT NULL AND "prefijo" <> '' AND "numero" IS NOT NULL AND "numero" <> ''
              GROUP BY "prefijo", "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
      {
        series: 'notas_ajuste_soporte(prefijo, numero)',
        sql: `SELECT "prefijo", "numero", ARRAY_AGG("id"::text) AS "ids" FROM "notas_ajuste_soporte"
              WHERE "prefijo" IS NOT NULL AND "prefijo" <> '' AND "numero" IS NOT NULL AND "numero" <> ''
              GROUP BY "prefijo", "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
      {
        series: 'comprobantes_contables(tipoComprobanteId, numero)',
        sql: `SELECT "tipoComprobanteId", "numero", ARRAY_AGG("id"::text) AS "ids" FROM "comprobantes_contables"
              WHERE "numero" IS NOT NULL AND "numero" <> ''
              GROUP BY "tipoComprobanteId", "numero" HAVING COUNT(*) > 1 LIMIT 10`,
      },
    ];

    const duplicates: string[] = [];
    for (const check of duplicateChecks) {
      const rows = await queryRunner.query(check.sql);
      for (const row of rows) {
        duplicates.push(`${check.series}: ${JSON.stringify(row)}`);
      }
    }
    if (duplicates.length) {
      throw new Error(
        `Hay números duplicados en el historial. Reconcilie los registros antes de crear las restricciones: ${duplicates.join('; ')}`,
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "secuencias_numeracion" (
        "clave" character varying(255) NOT NULL,
        "ultimoNumero" bigint NOT NULL DEFAULT 0,
        CONSTRAINT "PK_secuencias_numeracion_clave" PRIMARY KEY ("clave")
      )
    `);

    const seeds = [
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'factura-compra:FC', COALESCE(MAX(SPLIT_PART("numero", '-', 2)::bigint), 0)
       FROM "facturas_compras" WHERE "numero" ~ '^FC-[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'documento-soporte:DS', COALESCE(MAX(SPLIT_PART("numero", '-', 2)::bigint), 0)
       FROM "documentos_soporte" WHERE "numero" ~ '^DS-[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'pago:RC', COALESCE(MAX(SPLIT_PART("numero", '-', 2)::bigint), 0)
       FROM "pagos" WHERE "numero" ~ '^(RC|COB)-[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'pago:CE', COALESCE(MAX(SPLIT_PART("numero", '-', 2)::bigint), 0)
       FROM "pagos" WHERE "numero" ~ '^(CE|PAG)-[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'asiento', COALESCE(MAX("numero"::bigint), 0)
       FROM "asientos_contables" WHERE "numero" ~ '^[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'nota-venta:credito', COALESCE(MAX("numero"::bigint), 0)
       FROM "notas_ajuste" WHERE "tipo" = 'credito' AND "numero" ~ '^[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'nota-venta:debito', COALESCE(MAX("numero"::bigint), 0)
       FROM "notas_ajuste" WHERE "tipo" = 'debito' AND "numero" ~ '^[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'nota-compra:credito', COALESCE(MAX("numero"::bigint), 0)
       FROM "notas_ajuste_compras" WHERE "tipo" = 'credito' AND "numero" ~ '^[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'nota-compra:debito', COALESCE(MAX("numero"::bigint), 0)
       FROM "notas_ajuste_compras" WHERE "tipo" = 'debito' AND "numero" ~ '^[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'nota-soporte:credito', COALESCE(MAX("numero"::bigint), 0)
       FROM "notas_ajuste_soporte" WHERE "tipo" = 'credito' AND "numero" ~ '^[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'nota-soporte:debito', COALESCE(MAX("numero"::bigint), 0)
       FROM "notas_ajuste_soporte" WHERE "tipo" = 'debito' AND "numero" ~ '^[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'articulo:codigo', COALESCE(MAX(SPLIT_PART("codigo", '-', 2)::bigint), 0)
       FROM "articulos" WHERE "codigo" ~ '^[A-Z]-[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'activo-fijo:codigo', COALESCE(MAX(SPLIT_PART("codigo", '-', 2)::bigint), 0)
       FROM "activos_fijos" WHERE "codigo" ~ '^AF-[0-9]+$'
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'documento-soporte:reference:' || SPLIT_PART("referenceCode", '-', 2),
              MAX(SPLIT_PART("referenceCode", '-', 3)::bigint)
       FROM "documentos_soporte"
       WHERE "referenceCode" ~ '^DS-[0-9]{4}-[0-9]+$'
       GROUP BY SPLIT_PART("referenceCode", '-', 2)
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'nota-soporte:reference:' || SPLIT_PART("referenceCode", '-', 2),
              MAX(SPLIT_PART("referenceCode", '-', 3)::bigint)
       FROM "notas_ajuste_soporte"
       WHERE "referenceCode" ~ '^NAS-[0-9]{4}-[0-9]+$'
       GROUP BY SPLIT_PART("referenceCode", '-', 2)
       ON CONFLICT ("clave") DO NOTHING`,
      `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
       SELECT 'prescripcion:' || COALESCE("empresaId"::text, 'global') || ':' || SPLIT_PART("numero", '-', 2),
              MAX(SPLIT_PART("numero", '-', 3)::bigint)
       FROM "prescripciones_visuales"
       WHERE "numero" ~ '^PV-[0-9]{4}-[0-9]+$'
       GROUP BY COALESCE("empresaId"::text, 'global'), SPLIT_PART("numero", '-', 2)
       ON CONFLICT ("clave") DO NOTHING`,
    ];

    for (const seed of seeds) {
      await queryRunner.query(seed);
    }

    await queryRunner.query(`
      UPDATE "tipos_comprobantes" tipo
      SET "consecutivoActual" = GREATEST(
        COALESCE(tipo."consecutivoActual", 1),
        COALESCE((
          SELECT MAX(
            CASE
              WHEN COALESCE(tipo."prefijo", '') = '' AND comp."numero" ~ '^[0-9]+$'
                THEN comp."numero"::bigint
              WHEN COALESCE(tipo."prefijo", '') <> ''
                AND LEFT(comp."numero", LENGTH(tipo."prefijo") + 1) = tipo."prefijo" || '-'
                AND SPLIT_PART(comp."numero", '-', 2) ~ '^[0-9]+$'
                THEN SPLIT_PART(comp."numero", '-', 2)::bigint
            END
          ) + 1
          FROM "comprobantes_contables" comp
          WHERE comp."tipoComprobanteId" = tipo."id"
        ), 1)
      ),
      "updatedAt" = NOW()
    `);

    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_facturas_compras_numero_generado"
       ON "facturas_compras" ("numero") WHERE "numero" IS NOT NULL AND "numero" <> ''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_documentos_soporte_numero_generado"
       ON "documentos_soporte" ("numero") WHERE "numero" IS NOT NULL AND "numero" <> ''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_pagos_numero_generado"
       ON "pagos" ("numero") WHERE "numero" ~ '^(RC|CE|COB|PAG)-[0-9]+$'`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_asientos_contables_numero_generado"
       ON "asientos_contables" ("numero") WHERE "numero" IS NOT NULL AND "numero" <> ''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notas_ajuste_prefijo_numero"
       ON "notas_ajuste" ("prefijo", "numero") WHERE "prefijo" IS NOT NULL AND "prefijo" <> '' AND "numero" IS NOT NULL AND "numero" <> ''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notas_ajuste_compras_prefijo_numero"
       ON "notas_ajuste_compras" ("prefijo", "numero") WHERE "prefijo" IS NOT NULL AND "prefijo" <> '' AND "numero" IS NOT NULL AND "numero" <> ''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notas_ajuste_soporte_prefijo_numero"
       ON "notas_ajuste_soporte" ("prefijo", "numero") WHERE "prefijo" IS NOT NULL AND "prefijo" <> '' AND "numero" IS NOT NULL AND "numero" <> ''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_comprobantes_contables_tipo_numero"
       ON "comprobantes_contables" ("tipoComprobanteId", "numero") WHERE "numero" IS NOT NULL AND "numero" <> ''`,
    ];

    for (const index of indexes) {
      await queryRunner.query(index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      'UQ_comprobantes_contables_tipo_numero',
      'UQ_notas_ajuste_soporte_prefijo_numero',
      'UQ_notas_ajuste_compras_prefijo_numero',
      'UQ_notas_ajuste_prefijo_numero',
      'UQ_asientos_contables_numero_generado',
      'UQ_pagos_numero_generado',
      'UQ_documentos_soporte_numero_generado',
      'UQ_facturas_compras_numero_generado',
    ];
    for (const index of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "secuencias_numeracion"`);
  }
}
