import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelo NC por capas (guía 2026):
 * - items_nota_ajuste: snapshot original + input usuario + trazabilidad
 *   impuestos/retenciones + flag afectaInventario (resultado ya existía).
 * - notas_ajuste: factusReferenceCode estable para idempotencia.
 */
export class AddCreditNoteLayersToItems1719000000006 implements MigrationInterface {
  name = 'AddCreditNoteLayersToItems1719000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const itemColumns = [
      `"cantidadOriginal" numeric(10,2)`,
      `"precioOriginal" numeric(15,2)`,
      `"subtotalOriginal" numeric(15,2)`,
      `"valorDescuentoOriginal" numeric(15,2)`,
      `"valorIVAOriginal" numeric(15,2)`,
      `"totalOriginal" numeric(15,2)`,
      `"cantidadInput" numeric(10,2)`,
      `"precioNuevo" numeric(15,2)`,
      `"descuentoTasaInput" numeric(10,2)`,
      `"descuentoValorInput" numeric(15,2)`,
      `"detalleCalculo" json`,
      `"afectaInventario" boolean NOT NULL DEFAULT false`,
    ];
    for (const columnDef of itemColumns) {
      const columnName = columnDef.split(' ')[0].replace(/"/g, '');
      if (!(await queryRunner.hasColumn('items_nota_ajuste', columnName))) {
        await queryRunner.query(`ALTER TABLE "items_nota_ajuste" ADD ${columnDef}`);
      }
    }

    if (!(await queryRunner.hasColumn('notas_ajuste', 'factusReferenceCode'))) {
      await queryRunner.query(
        `ALTER TABLE "notas_ajuste" ADD "factusReferenceCode" varchar(120)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'cantidadOriginal',
      'precioOriginal',
      'subtotalOriginal',
      'valorDescuentoOriginal',
      'valorIVAOriginal',
      'totalOriginal',
      'cantidadInput',
      'precioNuevo',
      'descuentoTasaInput',
      'descuentoValorInput',
      'detalleCalculo',
      'afectaInventario',
    ]) {
      if (await queryRunner.hasColumn('items_nota_ajuste', column)) {
        await queryRunner.query(`ALTER TABLE "items_nota_ajuste" DROP COLUMN "${column}"`);
      }
    }
    if (await queryRunner.hasColumn('notas_ajuste', 'factusReferenceCode')) {
      await queryRunner.query(`ALTER TABLE "notas_ajuste" DROP COLUMN "factusReferenceCode"`);
    }
  }
}
