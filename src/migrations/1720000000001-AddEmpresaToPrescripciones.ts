import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmpresaToPrescripciones1720000000001 implements MigrationInterface {
  name = 'AddEmpresaToPrescripciones1720000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" ADD COLUMN IF NOT EXISTS "empresaId" uuid`);
    await queryRunner.query(`ALTER TABLE "profesionales_responsables" ADD COLUMN IF NOT EXISTS "empresaId" uuid`);
    await queryRunner.query(`ALTER TABLE "tipos_examen_prescripcion" ADD COLUMN IF NOT EXISTS "empresaId" uuid`);

    // Los registros existentes pertenecen a la empresa que ya operaba el sistema.
    // Si la empresa aún no fue inicializada, EmpresaService los completa al arrancar.
    await queryRunner.query(`
      UPDATE "prescripciones_visuales"
      SET "empresaId" = (SELECT "id" FROM "empresas" ORDER BY "createdAt" ASC LIMIT 1)
      WHERE "empresaId" IS NULL
        AND EXISTS (SELECT 1 FROM "empresas")
    `);
    await queryRunner.query(`
      UPDATE "profesionales_responsables" pr
      SET "empresaId" = p."empresaId"
      FROM "prescripciones_visuales" p
      WHERE pr."id" = p."profesionalId" AND p."empresaId" IS NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_prescripciones_empresa') THEN
          ALTER TABLE "prescripciones_visuales"
          ADD CONSTRAINT "FK_prescripciones_empresa" FOREIGN KEY ("empresaId")
          REFERENCES "empresas"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_profesionales_responsables_empresa') THEN
          ALTER TABLE "profesionales_responsables"
          ADD CONSTRAINT "FK_profesionales_responsables_empresa" FOREIGN KEY ("empresaId")
          REFERENCES "empresas"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tipos_examen_prescripcion_empresa') THEN
          ALTER TABLE "tipos_examen_prescripcion"
          ADD CONSTRAINT "FK_tipos_examen_prescripcion_empresa" FOREIGN KEY ("empresaId")
          REFERENCES "empresas"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`ALTER TABLE "tipos_examen_prescripcion" DROP CONSTRAINT IF EXISTS "UQ_tipos_examen_prescripcion_codigo"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tipos_examen_prescripcion_empresa_codigo"
      ON "tipos_examen_prescripcion" ("empresaId", "codigo") WHERE "empresaId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tipos_examen_prescripcion_codigo_global"
      ON "tipos_examen_prescripcion" ("codigo") WHERE "empresaId" IS NULL
    `);

    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" DROP CONSTRAINT IF EXISTS "UQ_prescripciones_visuales_numero"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_prescripciones_visuales_empresa_numero"
      ON "prescripciones_visuales" ("empresaId", "numero") WHERE "empresaId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_prescripciones_visuales_numero_sin_empresa"
      ON "prescripciones_visuales" ("numero") WHERE "empresaId" IS NULL
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prescripciones_visuales_empresa" ON "prescripciones_visuales" ("empresaId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_profesionales_responsables_empresa" ON "profesionales_responsables" ("empresaId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tipos_examen_prescripcion_empresa" ON "tipos_examen_prescripcion" ("empresaId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tipos_examen_prescripcion_empresa"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_profesionales_responsables_empresa"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescripciones_visuales_empresa"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_prescripciones_visuales_numero_sin_empresa"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_prescripciones_visuales_empresa_numero"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tipos_examen_prescripcion_codigo_global"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tipos_examen_prescripcion_empresa_codigo"`);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" DROP CONSTRAINT IF EXISTS "FK_prescripciones_empresa"`);
    await queryRunner.query(`ALTER TABLE "profesionales_responsables" DROP CONSTRAINT IF EXISTS "FK_profesionales_responsables_empresa"`);
    await queryRunner.query(`ALTER TABLE "tipos_examen_prescripcion" DROP CONSTRAINT IF EXISTS "FK_tipos_examen_prescripcion_empresa"`);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" ADD CONSTRAINT "UQ_prescripciones_visuales_numero" UNIQUE ("numero")`);
    await queryRunner.query(`ALTER TABLE "tipos_examen_prescripcion" ADD CONSTRAINT "UQ_tipos_examen_prescripcion_codigo" UNIQUE ("codigo")`);
    await queryRunner.query(`ALTER TABLE "prescripciones_visuales" DROP COLUMN "empresaId"`);
    await queryRunner.query(`ALTER TABLE "profesionales_responsables" DROP COLUMN "empresaId"`);
    await queryRunner.query(`ALTER TABLE "tipos_examen_prescripcion" DROP COLUMN "empresaId"`);
  }
}
