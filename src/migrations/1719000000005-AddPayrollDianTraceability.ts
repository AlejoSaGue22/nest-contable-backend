import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPayrollDianTraceability1719000000005 implements MigrationInterface {
  name = 'AddPayrollDianTraceability1719000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const liquidacionCols = [
      `"dian_reference_code" varchar(120)`,
      `"dian_cune" varchar(500)`,
      `"dian_numero" varchar`,
      `"dian_estado" varchar`,
      `"dian_mensaje_error" text`,
      `"dian_response" json`,
    ];
    for (const columnDef of liquidacionCols) {
      const columnName = columnDef.split(' ')[0].replace(/"/g, '');
      if (!(await queryRunner.hasColumn('liquidaciones_nomina', columnName))) {
        await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" ADD ${columnDef}`);
      }
    }

    const periodoCols = [
      `"factusNumberingRangeId" integer`,
      `"factus_resolution_number" varchar(80)`,
      `"factus_range_prefix" varchar(20)`,
    ];
    for (const columnDef of periodoCols) {
      const columnName = columnDef.split(' ')[0].replace(/"/g, '');
      if (!(await queryRunner.hasColumn('periodos_nomina', columnName))) {
        await queryRunner.query(`ALTER TABLE "periodos_nomina" ADD ${columnDef}`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'dian_reference_code',
      'dian_cune',
      'dian_numero',
      'dian_estado',
      'dian_mensaje_error',
      'dian_response',
    ]) {
      if (await queryRunner.hasColumn('liquidaciones_nomina', column)) {
        await queryRunner.query(`ALTER TABLE "liquidaciones_nomina" DROP COLUMN "${column}"`);
      }
    }
    for (const column of ['factusNumberingRangeId', 'factus_resolution_number', 'factus_range_prefix']) {
      if (await queryRunner.hasColumn('periodos_nomina', column)) {
        await queryRunner.query(`ALTER TABLE "periodos_nomina" DROP COLUMN "${column}"`);
      }
    }
  }
}
