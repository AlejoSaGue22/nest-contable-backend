import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kardex mínimo (v1): stock vivo en articulos.stock + auditoría en
 * movimientos_inventario (idempotente por documentoTipo + documentoId).
 */
export class CreateKardexMinimo1719000000008 implements MigrationInterface {
  name = 'CreateKardexMinimo1719000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('articulos', 'stock'))) {
      await queryRunner.query(
        `ALTER TABLE "articulos" ADD "stock" numeric(12,2) NOT NULL DEFAULT 0`,
      );
    }

    const existe = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'movimientos_inventario'`,
    );
    if (!existe.length) {
      await queryRunner.query(`
        CREATE TABLE "movimientos_inventario" (
          "id" uuid NOT NULL,
          "articuloId" uuid NOT NULL,
          "tipo" varchar NOT NULL,
          "cantidad" numeric(12,2) NOT NULL,
          "documentoTipo" varchar NOT NULL,
          "documentoId" varchar NOT NULL,
          "saldoDespues" numeric(12,2) NOT NULL,
          "motivo" text,
          "createdById" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_movimientos_inventario" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(
        `CREATE INDEX "IDX_mov_inv_articulo" ON "movimientos_inventario" ("articuloId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_mov_inv_documento" ON "movimientos_inventario" ("documentoTipo", "documentoId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "movimientos_inventario"`);
    if (await queryRunner.hasColumn('articulos', 'stock')) {
      await queryRunner.query(`ALTER TABLE "articulos" DROP COLUMN "stock"`);
    }
  }
}
