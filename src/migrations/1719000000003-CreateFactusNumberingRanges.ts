import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFactusNumberingRanges1719000000003 implements MigrationInterface {
  name = 'CreateFactusNumberingRanges1719000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "factus_numbering_ranges" (
        "id" uuid NOT NULL,
        "factus_id" integer NOT NULL,
        "domain" varchar(20) NOT NULL DEFAULT 'billing',
        "document" varchar(10),
        "prefix" varchar(20),
        "resolution_number" varchar(80),
        "technical_key" varchar(120),
        "from_number" integer,
        "to_number" integer,
        "current_number" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_expired" boolean NOT NULL DEFAULT false,
        "valid_from" timestamptz,
        "valid_to" timestamptz,
        "synced_at" timestamptz,
        "source" varchar(10) NOT NULL DEFAULT 'api',
        "empresa_id" uuid,
        "last_used_at" timestamptz,
        "raw_json" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_factus_numbering_ranges" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_factus_numbering_ranges_domain_factus'
        ) THEN
          ALTER TABLE "factus_numbering_ranges"
            ADD CONSTRAINT "UQ_factus_numbering_ranges_domain_factus" UNIQUE ("domain", "factus_id");
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_nr_domain_document"
        ON "factus_numbering_ranges" ("domain", "document")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "factus_numbering_ranges"`);
  }
}
