import { InternalServerErrorException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/** Atomically reserves the next number for a counter key in the current transaction. */
export async function nextSequentialNumber(manager: EntityManager, key: string): Promise<string> {
  const [row] = await manager.query(
    `INSERT INTO "secuencias_numeracion" ("clave", "ultimoNumero")
     VALUES ($1, 1)
     ON CONFLICT ("clave") DO UPDATE
       SET "ultimoNumero" = "secuencias_numeracion"."ultimoNumero" + 1
     RETURNING "ultimoNumero" AS "numero"`,
    [key],
  );

  const number = String(row?.numero ?? '');
  if (!/^[1-9]\d*$/.test(number)) {
    throw new InternalServerErrorException(`No fue posible reservar el consecutivo ${key}`);
  }
  return number;
}

/** Atomically increments a TipoComprobante counter and returns the old value. */
export async function nextTipoComprobanteNumber(manager: EntityManager, tipoComprobanteId: string): Promise<string> {
  const [row] = await manager.query(
    `UPDATE "tipos_comprobantes"
     SET "consecutivoActual" = "consecutivoActual" + 1,
         "updatedAt" = NOW()
     WHERE "id" = $1
     RETURNING "consecutivoActual" - 1 AS "numero"`,
    [tipoComprobanteId],
  );

  const number = String(row?.numero ?? '');
  if (!/^[1-9]\d*$/.test(number)) {
    throw new InternalServerErrorException('No fue posible reservar el consecutivo del tipo de comprobante');
  }
  return number;
}
