import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrescriptionCatalogs1720000000000 implements MigrationInterface {
  name = 'CreatePrescriptionCatalogs1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "tipos_examen_prescripcion" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "codigo" character varying(40) NOT NULL,
        "nombre" character varying(100) NOT NULL,
        "activo" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tipos_examen_prescripcion" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tipos_examen_prescripcion_codigo" UNIQUE ("codigo")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "tipos_examen_prescripcion" ("codigo", "nombre") VALUES
        ('VALORACION_VISUAL', 'Valoración Visual / Refracción Integral'),
        ('CONTROL', 'Control Periódico / Seguimiento'),
        ('ADAPTACION', 'Adaptación de Lentes de Contacto')
      ON CONFLICT ("codigo") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE "profesionales_responsables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nombre" character varying(150) NOT NULL,
        "especialidad" character varying(120),
        "registroProfesional" character varying(80),
        "firmaUrl" character varying,
        "activo" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profesionales_responsables" PRIMARY KEY ("id")
      )
    `);

    // Preserva las relaciones históricas con usuarios copiando esos profesionales
    // al nuevo catálogo con el mismo UUID.
    await queryRunner.query(`
      INSERT INTO "profesionales_responsables" ("id", "nombre", "activo")
      SELECT DISTINCT u."id", u."fullName", true
      FROM "users" u
      INNER JOIN "prescripciones_visuales" p ON p."profesionalId" = u."id"
      ON CONFLICT ("id") DO NOTHING
    `);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" DROP CONSTRAINT IF EXISTS "FK_prescripciones_profesional"`);
    await queryRunner.query(`
      ALTER TABLE "prescripciones_visuales"
      ADD CONSTRAINT "FK_prescripciones_profesional_responsable"
      FOREIGN KEY ("profesionalId") REFERENCES "profesionales_responsables"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" ADD COLUMN "tipoExamenId" uuid`);
    await queryRunner.query(`
      UPDATE "prescripciones_visuales" p
      SET "tipoExamenId" = t."id"
      FROM "tipos_examen_prescripcion" t
      WHERE t."codigo" = p."tipoExamen"
    `);
    await queryRunner.query(`
      UPDATE "prescripciones_visuales" p
      SET "tipoExamenId" = t."id"
      FROM "tipos_examen_prescripcion" t
      WHERE p."tipoExamenId" IS NULL AND t."codigo" = 'VALORACION_VISUAL'
    `);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" ALTER COLUMN "tipoExamenId" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "prescripciones_visuales"
      ADD CONSTRAINT "FK_prescripciones_tipo_examen"
      FOREIGN KEY ("tipoExamenId") REFERENCES "tipos_examen_prescripcion"("id")
    `);
    await queryRunner.query(`CREATE INDEX "IDX_prescripciones_tipo_examen" ON "prescripciones_visuales" ("tipoExamenId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescripciones_tipo_examen"`);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" DROP CONSTRAINT IF EXISTS "FK_prescripciones_tipo_examen"`);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" DROP COLUMN IF EXISTS "tipoExamenId"`);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" DROP CONSTRAINT IF EXISTS "FK_prescripciones_profesional_responsable"`);
    await queryRunner.query(`
      ALTER TABLE "prescripciones_visuales"
      ADD CONSTRAINT "FK_prescripciones_profesional"
      FOREIGN KEY ("profesionalId") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "profesionales_responsables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tipos_examen_prescripcion"`);
  }
}
