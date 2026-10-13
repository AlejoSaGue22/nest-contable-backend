import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAbonosFacturaBorrador1710000000000 implements MigrationInterface {
  name = 'CreateAbonosFacturaBorrador1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "abonos_factura_borrador" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "facturaVentaId" uuid NOT NULL,
        "monto" numeric(15,2) NOT NULL,
        "fecha" date NOT NULL,
        "medioPago" character varying(20) NOT NULL,
        "metodoPagoId" integer,
        "cuentaBancariaId" uuid,
        "referencia" character varying,
        "notas" text,
        "estado" character varying(20) NOT NULL DEFAULT 'pendiente',
        "creadoPorId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_abonos_factura_borrador" PRIMARY KEY ("id"),
        CONSTRAINT "FK_abonos_factura_borrador_factura" FOREIGN KEY ("facturaVentaId") REFERENCES "facturas_venta"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_abonos_factura_borrador_usuario" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_abonos_factura_borrador_factura_estado" ON "abonos_factura_borrador" ("facturaVentaId", "estado")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "abonos_factura_borrador"`);
  }
}
