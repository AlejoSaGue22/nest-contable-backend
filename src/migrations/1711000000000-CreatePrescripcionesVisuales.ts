import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreatePrescripcionesVisuales1711000000000 implements MigrationInterface {
  name = 'CreatePrescripcionesVisuales1711000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await q.query(`CREATE TABLE IF NOT EXISTS "prescripciones_visuales" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "numero" character varying(30) NOT NULL, "fechaExamen" date NOT NULL, "clienteId" uuid NOT NULL, "profesionalId" uuid, "tipoExamen" character varying(40) NOT NULL DEFAULT 'VALORACION_VISUAL', "tipoLente" character varying(20) NOT NULL, "ojoDerecho" jsonb NOT NULL DEFAULT '{}', "ojoIzquierdo" jsonb NOT NULL DEFAULT '{}', "lensometria" jsonb NOT NULL DEFAULT '{}', "datosContacto" jsonb NOT NULL DEFAULT '{}', "usoIndicado" character varying(80), "material" character varying(100), "filtroTratamiento" character varying(150), "tipoLenteDescripcion" character varying(120), "fechaControl" date, "indicaciones" text, "observaciones" text, "recomendaciones" text, "estado" character varying(20) NOT NULL DEFAULT 'ACTIVA', "creadoPorId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_prescripciones_visuales" PRIMARY KEY ("id"), CONSTRAINT "UQ_prescripciones_visuales_numero" UNIQUE ("numero"), CONSTRAINT "FK_prescripciones_cliente" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id"), CONSTRAINT "FK_prescripciones_profesional" FOREIGN KEY ("profesionalId") REFERENCES "users"("id") ON DELETE SET NULL, CONSTRAINT "FK_prescripciones_creador" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE SET NULL)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_prescripciones_fecha" ON "prescripciones_visuales" ("fechaExamen")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_prescripciones_cliente" ON "prescripciones_visuales" ("clienteId")`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE IF EXISTS "prescripciones_visuales"`); }
}
