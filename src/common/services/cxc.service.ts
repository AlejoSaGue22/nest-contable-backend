import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';

import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FormaPago, InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { PaymentStatus } from 'src/pagos/enums/pago.enum';
import { AgingBucket, CxcItem, CxcResumen, CxFiltros } from '../dtos/cxc_cxp.dto';


@Injectable()
export class CxcService {
  private readonly logger = new Logger(CxcService.name);

  constructor(
    @InjectRepository(FacturasVenta)
    private readonly facturaVentaRepository: Repository<FacturasVenta>,
  ) {}

  /**
   * Lista todas las cuentas por cobrar activas (saldo > 0).
   * Filtra solo facturas a CRÉDITO con paymentStatus != PAID.
   */
  async findAll(filtros?: CxFiltros)
                : Promise<{ items: CxcItem[]; resumen: CxcResumen, meta: { page: number, total: number, totalPages: number } }> {
    try {
      const queryBuilder = this.facturaVentaRepository
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.client', 'client')
        .where('f.formaPago = :formaPago', { formaPago: FormaPago.CREDITO })
        .andWhere('f.paymentStatus IN (:...estados)', {
          estados: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.status NOT IN (:...excluidos)', {
          excluidos: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
        });

      if (filtros?.clienteId) {
        queryBuilder.andWhere('f.clientId = :clienteId', { clienteId: filtros.clienteId });
      }

      if (filtros?.paymentStatus) {
        queryBuilder.andWhere('f.paymentStatus = :ps', { ps: filtros.paymentStatus });
      }

      if (filtros?.soloVencidas) {
        queryBuilder.andWhere('f.paymentStatus = :overdue', { overdue: PaymentStatus.OVERDUE });
      }

      queryBuilder.orderBy('f.fechaVencimiento', 'ASC');

      const page = filtros?.page || 1;
      const limit = filtros?.limit || 10;
      const skip = (page - 1) * limit;

      const [facturas, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const items: CxcItem[] = facturas.map(f => {
        const diasVencida = this.calcularDiasVencida(f.fechaVencimiento, hoy);

        return {
            facturaId:        f.id,
            numeroFactura:    f.comprobante_completo,
            clienteId:        f.clientId,
            clienteNombre:    f.client.razonSocial || f.client?.nombre + ' ' + f.client?.apellido,
            fechaEmision:     f.fecha,
            fechaVencimiento: f.fechaVencimiento, 
            diasVencida,
            total:            f.total,
            totalPagado:      f.totalPagado,
            saldoPendiente:   f.saldoPendiente,
            paymentStatus:    f.paymentStatus || PaymentStatus.PENDING,
            agingBucket:      this.calcularAgingBucket(diasVencida),
        };
      });

      const resumen = this.calcularResumen(items);

      return { items, resumen, meta: { page, total, totalPages: Math.ceil(total / limit) } };

    } catch (error) {
      this.logger.error(`Error obteniendo CxC: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al obtener cuentas por cobrar');
    }
  }

  /**
   * Reporte Aging (antigüedad de cartera) por cliente.
   * Agrupa el saldo de cada cliente en los buckets estándar.
   */
  async aging(): Promise<{
    porCliente: Array<{
      clienteId:    string;
      clienteNombre: string;
      porVencer:    number;
      de1a30:       number;
      de31a60:      number;
      de61a90:      number;
      mas90:        number;
      total:        number;
    }>;
    totales: AgingBucket & { total: number };
  }> {
    const { items } = await this.findAll();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Agrupar por cliente
    const mapaClientes = new Map<string, any>();

    for (const item of items) {
      if (!mapaClientes.has(item.clienteId)) {
        mapaClientes.set(item.clienteId, {
          clienteId:     item.clienteId,
          clienteNombre: item.clienteNombre,
          porVencer:     0,
          de1a30:        0,
          de31a60:       0,
          de61a90:       0,
          mas90:         0,
          total:         0,
        });
      }
      const entry = mapaClientes.get(item.clienteId);
      entry[item.agingBucket] += item.saldoPendiente;
      entry.total             += item.saldoPendiente;
    }

    const porCliente = Array.from(mapaClientes.values());

    // Totales generales
    const totales = porCliente.reduce(
      (acc, c) => ({
        porVencer: acc.porVencer + c.porVencer,
        de1a30:    acc.de1a30   + c.de1a30,
        de31a60:   acc.de31a60  + c.de31a60,
        de61a90:   acc.de61a90  + c.de61a90,
        mas90:     acc.mas90    + c.mas90,
        total:     acc.total    + c.total,
      }),
      { porVencer: 0, de1a30: 0, de31a60: 0, de61a90: 0, mas90: 0, total: 0 },
    );

    return { porCliente, totales };
  }

  /** Estado de cuenta de un cliente específico */
  async estadoCuentaCliente(clienteId: string): Promise<{
    clienteId:    string;
    totalDeuda:   number;
    facturas:     CxcItem[];
    aging:        AgingBucket;
  }> {
    const { items } = await this.findAll({ clienteId });

    const aging: AgingBucket = { porVencer: 0, de1a30: 0, de31a60: 0, de61a90: 0, mas90: 0 };
    let totalDeuda = 0;

    for (const item of items) {
      aging[item.agingBucket] += item.saldoPendiente;
      totalDeuda              += item.saldoPendiente;
    }

    return { clienteId, totalDeuda, facturas: items, aging };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private parseFechaLocal(fecha: string): Date {
    const [year, month, day] = fecha.split('-').map(Number);
    return new Date(year, month - 1, day); // LOCAL
  }

  private calcularDiasVencida(fechaVencimiento: Date | null, hoy: Date = new Date()): number {
      if (!fechaVencimiento) return 0;

      const venc = this.parseFechaLocal(fechaVencimiento.toString());
      const actual = new Date(hoy);

      venc.setHours(0, 0, 0, 0);
      actual.setHours(0, 0, 0, 0);

      const diffMs = venc.getTime() - actual.getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  private calcularAgingBucket(diasVencida: number): keyof AgingBucket {
    if (diasVencida <= 0)  return 'porVencer';
    if (diasVencida <= 30) return 'de1a30';
    if (diasVencida <= 60) return 'de31a60';
    if (diasVencida <= 90) return 'de61a90';
    return 'mas90';
  }

  private calcularResumen(items: CxcItem[]): CxcResumen {
    return items.reduce(
      (acc, item) => ({
        totalCartera:      acc.totalCartera      + item.saldoPendiente,
        porVencer:         acc.porVencer         + (item.diasVencida <= 0 ? item.saldoPendiente : 0),
        vencida:           acc.vencida           + (item.diasVencida >  0 ? item.saldoPendiente : 0),
        cantidadPorVencer: acc.cantidadPorVencer + (item.diasVencida <= 0 ? 1 : 0),
        cantidadVencida:   acc.cantidadVencida   + (item.diasVencida >  0 ? 1 : 0),
      }),
      { totalCartera: 0, porVencer: 0, vencida: 0, cantidadPorVencer: 0, cantidadVencida: 0 },
    );
  }
}