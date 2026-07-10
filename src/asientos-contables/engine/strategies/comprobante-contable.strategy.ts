import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IContabilizacionStrategy } from '../contabilizacion-strategy.interface';
import { DefinicionAsientoDto, DefinicionDetalleAsientoDto } from '../../dto/definicion-asiento.dto';
import { ComprobanteContable } from 'src/comprobantes/entities/comprobante-contable.entity';

@Injectable()
export class ComprobanteContableStrategy implements IContabilizacionStrategy {
  readonly tipoDocumento = 'COMPROBANTE_CONTABLE';

  constructor(private readonly dataSource: DataSource) {}

  async generarDefinicion(
    documentoId: string,
    queryRunner?: QueryRunner,
  ): Promise<DefinicionAsientoDto> {
    const manager = queryRunner ? queryRunner.manager : this.dataSource.manager;

    // Obtener el comprobante con todas sus relaciones
    const comprobante = await manager.findOne(ComprobanteContable, {
      where: { id: documentoId },
      relations: [
        'tipoComprobante',
        'detalles',
        'detalles.cuentaContable',
        'detalles.cliente',
        'detalles.proveedor',
        'detalles.centroCosto',
      ],
    });

    if (!comprobante) {
      throw new NotFoundException(`Comprobante contable con ID ${documentoId} no encontrado.`);
    }

    const detalles: DefinicionDetalleAsientoDto[] = [];

    for (const d of comprobante.detalles) {
      let terceroNombre = '';
      if (d.cliente) {
        terceroNombre = d.cliente.razonSocial || `${d.cliente.nombre || ''} ${d.cliente.apellido || ''}`.trim();
      } else if (d.proveedor) {
        terceroNombre = d.proveedor.razonSocial || `${d.proveedor.nombre || ''} ${d.proveedor.apellido || ''}`.trim();
      }

      detalles.push({
        cuentaId: d.cuentaContableId,
        cuentaCodigo: d.cuentaContable.codigo,
        cuentaNombre: d.cuentaContable.nombre,
        debito: Number(d.debito),
        credito: Number(d.credito),
        concepto: d.descripcion || comprobante.observaciones || '',
        
        clienteId: d.clienteId || undefined,
        proveedorId: d.proveedorId || undefined,
        terceroId: d.clienteId || d.proveedorId || undefined,
        terceroNombre: terceroNombre || undefined,
        
        centroCostoId: d.centroCostoId || undefined,
        centroCostoNombre: d.centroCosto?.nombre || undefined,
        
        documentoReferencia: d.documentoReferencia || undefined,
      });
    }

    const totalDebito = detalles.reduce((sum, d) => sum + d.debito, 0);
    const totalCredito = detalles.reduce((sum, d) => sum + d.credito, 0);
    const diferencia = Math.abs(totalDebito - totalCredito);
    const estaBalanceado = diferencia <= 0.01;

    return {
      tipo: 'COMPROBANTE_CONTABLE',
      fecha: comprobante.fechaDocumento || new Date(),
      referencia: comprobante.numero,
      descripcion: comprobante.observaciones || `Asiento - ${comprobante.tipoComprobante.nombre} ${comprobante.numero}`,
      detalles,
      totalDebito,
      totalCredito,
      estaBalanceado,
      diferencia,
    };
  }
}
