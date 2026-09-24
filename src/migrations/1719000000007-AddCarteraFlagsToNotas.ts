import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sincronización de cartera al aceptar NC:
 * - saldoAplicado: la NC ya movió totalPagado/saldoPendiente (una sola vez).
 * - valorAplicadoCartera: monto exacto aplicado (para reversar al anular).
 */
export class AddCarteraFlagsToNotas1719000000007 implements MigrationInterface {
  name = 'AddCarteraFlagsToNotas1719000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('notas_ajuste', 'saldoAplicado'))) {
      await queryRunner.query(
        `ALTER TABLE "notas_ajuste" ADD "saldoAplicado" boolean NOT NULL DEFAULT false`,
      );
    }
    if (!(await queryRunner.hasColumn('notas_ajuste', 'valorAplicadoCartera'))) {
      await queryRunner.query(
        `ALTER TABLE "notas_ajuste" ADD "valorAplicadoCartera" numeric(15,2)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ['saldoAplicado', 'valorAplicadoCartera']) {
      if (await queryRunner.hasColumn('notas_ajuste', column)) {
        await queryRunner.query(`ALTER TABLE "notas_ajuste" DROP COLUMN "${column}"`);
      }
    }
  }
}
