import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { TipoComprobante } from './entities/tipo-comprobante.entity';
import { CreateComprobanteDetalleDto } from './dto/comprobante-contable.dto';

@Injectable()
export class ComprobantesValidatorService {
  constructor(
    @InjectRepository(CuentaContable)
    private readonly cuentaRepository: Repository<CuentaContable>,
  ) { }

  /**
   * Realiza todas las validaciones contables y de negocio para un comprobante
   */
  async validarComprobante(
    tipoComprobante: TipoComprobante,
    detallesDto: CreateComprobanteDetalleDto[],
  ): Promise<void> {
    if (!detallesDto || detallesDto.length === 0) {
      throw new BadRequestException('El comprobante debe tener al menos un movimiento contable.');
    }

    // 1. Validar balance (Partida Doble)
    let totalDebito = 0;
    let totalCredito = 0;

    for (const d of detallesDto) {
      totalDebito += Number(d.debito || 0);
      totalCredito += Number(d.credito || 0);
    }

    const diferencia = Math.abs(totalDebito - totalCredito);
    if (diferencia > 0.01) {
      throw new BadRequestException(
        `El comprobante está descuadrado. Total Débito: $${totalDebito.toLocaleString('es-CO')}, Total Crédito: $${totalCredito.toLocaleString('es-CO')}. Diferencia: $${diferencia.toLocaleString('es-CO')}`,
      );
    }

    // Obtener los IDs únicos de las cuentas involucradas para consultarlas por lote
    const cuentaIds = [...new Set(detallesDto.map((d) => d.cuentaContableId))];
    const cuentas = await this.cuentaRepository.findByIds(cuentaIds);
    const cuentasMap = new Map<string, CuentaContable>(cuentas.map((c) => [c.id, c]));

    // 2. Validar reglas de cada línea de movimiento
    for (let i = 0; i < detallesDto.length; i++) {
      const d = detallesDto[i];
      const linea = i + 1;
      const cuenta = cuentasMap.get(d.cuentaContableId);

      if (!cuenta) {
        throw new BadRequestException(`Línea ${linea}: La cuenta contable con ID ${d.cuentaContableId} no existe.`);
      }

      // a. Cuenta activa
      if (!cuenta.isActive) {
        throw new BadRequestException(`Línea ${linea}: La cuenta contable ${cuenta.codigo} - ${cuenta.nombre} está inactiva.`);
      }

      // b. Cuenta auxiliar (acepta movimiento)
      if (!cuenta.aceptaMovimiento) {
        throw new BadRequestException(
          `Línea ${linea}: La cuenta ${cuenta.codigo} es de nivel superior o mayor. Solo se permite registrar movimientos en cuentas auxiliares.`,
        );
      }

      // c. Validación de Tercero Obligatorio
      if (cuenta.requiereTercero && !d.clienteId && !d.proveedorId && !d.entidadSSId) {
        throw new BadRequestException(
          `Línea ${linea}: La cuenta ${cuenta.codigo} exige registrar un tercero (Cliente, Proveedor o Entidad de Seguridad Social).`,
        );
      }

      // d. Validación de Centro de Costos
      if (cuenta.requiereCentroCostos && !d.centroCostoId) {
        throw new BadRequestException(
          `Línea ${linea}: La cuenta ${cuenta.codigo} exige registrar un Centro de Costos.`,
        );
      }

      // e. Documento de referencia obligatorio según el tipo de comprobante
      if (tipoComprobante.docReferenciaObligatorio && (!d.documentoReferencia || d.documentoReferencia.trim() === '')) {
        throw new BadRequestException(
          `Línea ${linea}: El tipo de comprobante '${tipoComprobante.nombre}' exige registrar un documento de referencia.`,
        );
      }
    }
  }
}
