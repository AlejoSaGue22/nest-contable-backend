import { MigrationInterface, QueryRunner } from 'typeorm';

const COLUMNS = [
  `"factusNumberingRangeId" integer`,
  `"factus_resolution_number" varchar(80)`,
  `"factus_range_prefix" varchar(20)`,
];

export class AddFactusRangeSnapshotToDocs1719000000004 implements MigrationInterface {
  name = 'AddFactusRangeSnapshotToDocs1719000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['facturas_venta', 'notas_ajuste']) {
      for (const columnDef of COLUMNS) {
        const columnName = columnDef.split(' ')[0].replace(/"/g, '');
        if (!(await queryRunner.hasColumn(table, columnName))) {
          await queryRunner.query(`ALTER TABLE "${table}" ADD ${columnDef}`);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['facturas_venta', 'notas_ajuste']) {
      for (const column of ['factusNumberingRangeId', 'factus_resolution_number', 'factus_range_prefix']) {
        if (await queryRunner.hasColumn(table, column)) {
          await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
        }
      }
    }
  }
}
