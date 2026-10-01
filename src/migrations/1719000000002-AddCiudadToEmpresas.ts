import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCiudadToEmpresas1719000000002 implements MigrationInterface {
  name = 'AddCiudadToEmpresas1719000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('empresas', 'ciudad'))) {
      await queryRunner.query(`ALTER TABLE "empresas" ADD "ciudad" integer`);
    }
    const table = await queryRunner.getTable('empresas');
    const hasFk = table?.foreignKeys.some((fk) => fk.columnNames.includes('ciudad'));
    if (!hasFk) {
      await queryRunner.query(
        `ALTER TABLE "empresas" ADD CONSTRAINT "FK_empresas_ciudad" FOREIGN KEY ("ciudad") REFERENCES "municipios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('empresas');
    const fk = table?.foreignKeys.find((foreignKey) => foreignKey.columnNames.includes('ciudad'));
    if (fk) {
      await queryRunner.query(`ALTER TABLE "empresas" DROP CONSTRAINT "${fk.name}"`);
    }
    if (await queryRunner.hasColumn('empresas', 'ciudad')) {
      await queryRunner.query(`ALTER TABLE "empresas" DROP COLUMN "ciudad"`);
    }
  }
}
