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
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content) as { municipalities?: MunicipalityJsonItem[] };

    for (const municipality of parsed.municipalities || []) {
      await queryRunner.query(
        `UPDATE "municipios"
         SET "departmentCode" = $1, "departmentName" = $2, "department" = $2
         WHERE "code" = $3`,
        [municipality.department.code, municipality.department.name, municipality.code],
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // El backfill no elimina información existente al revertir.
  }
}
