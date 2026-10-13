import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

interface MunicipalityJsonItem {
  code: string;
  department: {
    code: string;
    name: string;
  };
}

export class BackfillMunicipalityDepartmentCodes1719000000001 implements MigrationInterface {
  name = 'BackfillMunicipalityDepartmentCodes1719000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const filePath = path.join(process.cwd(), 'json-municipios.json');
    if (!fs.existsSync(filePath)) {
      return;
    }

    // 1. Si ya no existen municipios con departmentCode nulo, no hacer nada (idempotente)
    const pending = await queryRunner.query(
      `SELECT 1 FROM "municipios" WHERE "departmentCode" IS NULL LIMIT 1`,
    );
    if (!pending || pending.length === 0) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as { municipalities?: MunicipalityJsonItem[] };
    const municipalities = parsed.municipalities || [];
    if (municipalities.length === 0) {
      return;
    }

    // 2. Ejecutar la actualización en lotes para evitar miles de queries individuales en consola
    const batchSize = 200;
    for (let i = 0; i < municipalities.length; i += batchSize) {
      const batch = municipalities.slice(i, i + batchSize);
      const values: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const m of batch) {
        values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2})`);
        params.push(m.code, m.department.code, m.department.name);
        paramIdx += 3;
      }

      await queryRunner.query(
        `UPDATE "municipios" AS m
         SET "departmentCode" = v.dept_code,
             "departmentName" = v.dept_name,
             "department"     = v.dept_name
         FROM (VALUES ${values.join(', ')}) AS v(code, dept_code, dept_name)
         WHERE m."code" = v.code`,
        params,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // El backfill no elimina información existente al revertir.
  }
}
