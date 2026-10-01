import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * H5 (cierre de inventario):
 * - movimientos_inventario.empresaId (base multi-empresa, nullable para no
 *   romper el kardex histórico; los movimientos nuevos heredan la del artículo).
 * - articulos.isInventariable default false (los servicios no entran al
 *   kardex por descuido; filas existentes intactas).
 */
export class KardexEmpresaYDefaultInventariable1719000000009 implements MigrationInterface {
  name = 'KardexEmpresaYDefaultInventariable1719000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('movimientos_inventario', 'empresaId'))) {
      await queryRunner.query(
        `ALTER TABLE "movimientos_inventario" ADD "empresaId" uuid`,
      );
    }
    const idx = await queryRunner.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'IDX_mov_inv_empresa'`,
    );
    if (!idx.length) {
      await queryRunner.query(
        `CREATE INDEX "IDX_mov_inv_empresa" ON "movimientos_inventario" ("empresaId")`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "articulos" ALTER COLUMN "isInventariable" SET DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mov_inv_empresa"`);
    if (await queryRunner.hasColumn('movimientos_inventario', 'empresaId')) {
      await queryRunner.query(`ALTER TABLE "movimientos_inventario" DROP COLUMN "empresaId"`);
    }
    await queryRunner.query(
      `ALTER TABLE "articulos" ALTER COLUMN "isInventariable" SET DEFAULT true`,
    );
  }
}
