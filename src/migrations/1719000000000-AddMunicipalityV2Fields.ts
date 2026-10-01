import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMunicipalityV2Fields1719000000000 implements MigrationInterface {
  name = 'AddMunicipalityV2Fields1719000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasDeptCode = await queryRunner.hasColumn('municipios', 'departmentCode');
    if (!hasDeptCode) {
      await queryRunner.query(
        `ALTER TABLE "municipios" ADD "departmentCode" character varying`,
      );
    }
    const hasDeptName = await queryRunner.hasColumn('municipios', 'departmentName');
    if (!hasDeptName) {
      await queryRunner.query(
        `ALTER TABLE "municipios" ADD "departmentName" character varying`,
      );
    }
    await queryRunner.query(
      `UPDATE "municipios" SET "departmentName" = "department" WHERE "departmentName" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "municipios" DROP COLUMN "departmentName"`);
    await queryRunner.query(`ALTER TABLE "municipios" DROP COLUMN "departmentCode"`);
  }
}
