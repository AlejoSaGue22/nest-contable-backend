import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { PaymentStatus } from 'src/pagos/enums/pago.enum';
import { AgingBucket, AgingCxp } from '../dtos/cxc_cxp.dto';

export interface CxpItem {
  facturaId:        string;
  numeroFactura:    string | null;
  proveedorId:      string;
  proveedorNombre:  string;
  fechaEmision:     Date;
  fechaVencimiento: Date | null;
  diasVencida:      number;
  total:            number;
  totalPagado:      number;
  saldoPendiente:   number;
  paymentStatus:    PaymentStatus;
  agingBucket:      keyof AgingBucket;
}

export interface CxpResumen {
  totalPorPagar:     number;
  porVencer:         number;
  vencida:           number;
  cantidadPorVencer: number;
  cantidadVencida:   number;
}

@Injectable()
export class CxpService {
  private readonly logger = new Logger(CxpService.name);

  constructor(
    @InjectRepository(FacturaCompra)
    private readonly facturaCompraRepository: Repository<FacturaCompra>,
  ) {}

   /**
    * Lista todas las cuentas por pagar activas (saldo > 0).
    * Filtra solo facturas de compra a CRÉDITO con paymentStatus != PAID.
   */
  async findAll(filtros?: {
    proveedorId?:  string;
    paymentStatus?: PaymentStatus;
    soloVencidas?:  boolean;
  }): Promise<{ items: CxpItem[]; resumen: CxpResumen }> {
    try {
      const queryBuilder = this.facturaCompraRepository
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.proveedor', 'proveedor')
        .where('f.formaPago = :formaPago', { formaPago: 'CREDITO' })
        .andWhere('f.paymentStatus IN (:...estados)', {
          estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.estado NOT IN (:...excluidos)', {
          excluidos: [GastoEstado.ANULADO, GastoEstado.BORRADOR],
        });

      if (filtros?.proveedorId) {
        queryBuilder.andWhere('f.proveedorId = :proveedorId', { proveedorId: filtros.proveedorId });
      }

      if (filtros?.paymentStatus) {
        queryBuilder.andWhere('f.paymentStatus = :ps', { ps: filtros.paymentStatus });
      }

      if (filtros?.soloVencidas) {
        queryBuilder.andWhere('f.paymentStatus = :overdue', { overdue: PaymentStatus.OVERDUE });
      }

      queryBuilder.orderBy('f.fechaVencimiento', 'ASC');

      const facturas = await queryBuilder.getMany();
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const items: CxpItem[] = facturas.map(f => {
        const diasVencida = this.calcularDiasVencida(f.fechaVencimiento, hoy);
        return {
          facturaId:        f.id,
          numeroFactura:    f.numero,
          proveedorId:      f.proveedorId,
          proveedorNombre:  f.proveedor.razonSocial || `${f.proveedor.nombre} ${f.proveedor.apellido}`,
          fechaEmision:     f.fecha,
          fechaVencimiento: f.fechaVencimiento,
          diasVencida,
          total:            f.total,
          totalPagado:      f.totalPagado,
          saldoPendiente:   f.saldoPendiente,
          paymentStatus:    f.paymentStatus,
          agingBucket:      this.calcularAgingBucket(diasVencida),
        };
      });

      const resumen = this.calcularResumen(items);

      return { items, resumen };
    } catch (error) {
      this.logger.error(`Error obteniendo CxP: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al obtener cuentas por pagar');
    }
  }

  /**
   * Reporte Aging de cuentas por pagar agrupado por proveedor.
   */
  async aging(): Promise<AgingCxp> {
    const { items } = await this.findAll();

    const mapaProveedores = new Map<string, any>();

    for (const item of items) {
      if (!mapaProveedores.has(item.proveedorId)) {
        mapaProveedores.set(item.proveedorId, {
          proveedorId:     item.proveedorId,
          proveedorNombre: item.proveedorNombre,
          porVencer:       0,
          de1a30:          0,
          de31a60:         0,
          de61a90:         0,
          mas90:           0,
          total:           0,
        });
      }
      const entry = mapaProveedores.get(item.proveedorId);
      entry[item.agingBucket] += item.saldoPendiente;
      entry.total             += item.saldoPendiente;
    }

    const porProveedor = Array.from(mapaProveedores.values());

    const totales = porProveedor.reduce(
      (acc, p) => ({
        porVencer: acc.porVencer + p.porVencer,
        de1a30:    acc.de1a30   + p.de1a30,
        de31a60:   acc.de31a60  + p.de31a60,
        de61a90:   acc.de61a90  + p.de61a90,
        mas90:     acc.mas90    + p.mas90,
        total:     acc.total    + p.total,
      }),
      { porVencer: 0, de1a30: 0, de31a60: 0, de61a90: 0, mas90: 0, total: 0 },
    );

    return { porProveedor, totales };
  }

  /** Estado de cuenta de un proveedor específico */
  async estadoCuentaProveedor(proveedorId: string): Promise<{
    proveedorId:  string;
    totalDeuda:   number;
    facturas:     CxpItem[];
    aging:        AgingBucket;
  }> {
    const { items } = await this.findAll({ proveedorId });

    const aging: AgingBucket = { porVencer: 0, de1a30: 0, de31a60: 0, de61a90: 0, mas90: 0 };
    let totalDeuda = 0;

    for (const item of items) {
      aging[item.agingBucket] += item.saldoPendiente;
      totalDeuda              += item.saldoPendiente;
    }

    return { proveedorId, totalDeuda, facturas: items, aging };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private calcularDiasVencida(fechaVencimiento: Date | null, hoy: Date): number {
    if (!fechaVencimiento) return 0;
    const venc = new Date(fechaVencimiento);
    venc.setHours(0, 0, 0, 0);
    return Math.floor((hoy.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  }

  private calcularAgingBucket(diasVencida: number): keyof AgingBucket {
    if (diasVencida <= 0)  return 'porVencer';
    if (diasVencida <= 30) return 'de1a30';
    if (diasVencida <= 60) return 'de31a60';
    if (diasVencida <= 90) return 'de61a90';
    return 'mas90';
  }

  private calcularResumen(items: CxpItem[]): CxpResumen {
    return items.reduce(
      (acc, item) => ({
        totalPorPagar:     acc.totalPorPagar     + item.saldoPendiente,
        porVencer:         acc.porVencer         + (item.diasVencida <= 0 ? item.saldoPendiente : 0),
        vencida:           acc.vencida           + (item.diasVencida >  0 ? item.saldoPendiente : 0),
        cantidadPorVencer: acc.cantidadPorVencer + (item.diasVencida <= 0 ? 1 : 0),
        cantidadVencida:   acc.cantidadVencida   + (item.diasVencida >  0 ? 1 : 0),
      }),
      { totalPorPagar: 0, porVencer: 0, vencida: 0, cantidadPorVencer: 0, cantidadVencida: 0 },
    );
  }
}