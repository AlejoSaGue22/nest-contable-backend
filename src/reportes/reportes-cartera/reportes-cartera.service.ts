import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { Pago } from 'src/pagos/entities/pago.entity';
import { PaymentStatus, TipoPago } from 'src/pagos/enums/pago.enum';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { FormaPago, InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { AgingGroup, AgingReporte, AgingRow, HistorialPagosReporte, ResumenCartera } from './dto/reportes-cartera.dto';

// ─── Servicio ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportesCarteraService {
  private readonly logger = new Logger(ReportesCarteraService.name);

  constructor(
    @InjectRepository(FacturasVenta)
    private readonly facturaVentaRepo: Repository<FacturasVenta>,

    @InjectRepository(FacturaCompra)
    private readonly facturaCompraRepo: Repository<FacturaCompra>,

    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // AGING CxC — Antigüedad de cartera por cobrar
  // ══════════════════════════════════════════════════════════════
  async agingCobrar(fechaInicio?: Date, fechaFin?: Date): Promise<AgingReporte> {
    try {
      const query = this.facturaVentaRepo
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.client', 'c')
        .where('f.formaPago = :fp',       { fp: FormaPago.CREDITO })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.paymentStatus IN (:...ps)', {
          ps: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.status NOT IN (:...exc)', {
          exc: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
        });

      if (fechaInicio && fechaFin) {
        query.andWhere('f.fecha BETWEEN :inicio AND :fin', {
          inicio: fechaInicio,
          fin:    fechaFin,
        });
      }

      const facturas = await query
        .orderBy('f.fechaVencimiento', 'ASC')
        .getMany();

      return this.construirAgingReporte(
        facturas.map(f => ({
          id:            f.id,
          numero:        f.comprobante_completo,
          contraparteId: f.clientId,
          contraparte:   f.client?.razonSocial ?? f.client?.nombre ?? f.clientId,
          emision:       f.fecha,
          vencimiento:   f.fechaVencimiento,
          total:         f.total,
          pagado:        f.totalPagado,
          saldo:         f.saldoPendiente,
          paymentStatus: f.paymentStatus || PaymentStatus.PENDING,
        })),
      );
    } catch (error) {
      this.logger.error(`Error aging CxC: ${error.message}`);
      throw new InternalServerErrorException('Error al generar reporte aging CxC');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // AGING CxP — Antigüedad de deuda por pagar
  // ══════════════════════════════════════════════════════════════
  async agingPagar(fechaInicio?: Date, fechaFin?: Date): Promise<AgingReporte> {
    try {
      const query = this.facturaCompraRepo
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.proveedor', 'p')
        .where('f.formaPago = :fp',       { fp: 'CREDITO' })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.paymentStatus IN (:...ps)', {
          ps: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.estado NOT IN (:...exc)', {
          exc: [GastoEstado.ANULADO, GastoEstado.BORRADOR],
        });

      if (fechaInicio && fechaFin) {
        query.andWhere('f.fecha BETWEEN :inicio AND :fin', {
          inicio: fechaInicio,
          fin:    fechaFin,
        });
      }

      const facturas = await query
        .orderBy('f.fechaVencimiento', 'ASC')
        .getMany();

      return this.construirAgingReporte(
        facturas.map(f => ({
          id:            f.id,
          numero:        f.numero || '—',
          contraparteId: f.proveedorId,
          contraparte:   f.proveedor?.razonSocial ?? f.proveedor?.nombre ?? f.proveedorId,
          emision:       f.fecha,
          vencimiento:   f.fechaVencimiento,
          total:         f.total,
          pagado:        f.totalPagado,
          saldo:         f.saldoPendiente,
          paymentStatus: f.paymentStatus || PaymentStatus.PENDING,
        })),
      );
    } catch (error) {
      this.logger.error(`Error aging CxP: ${error.message}`);
      throw new InternalServerErrorException('Error al generar reporte aging CxP');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // HISTORIAL DE PAGOS por período
  // ══════════════════════════════════════════════════════════════
  async historialPagos(
    fechaInicio: Date,
    fechaFin:    Date,
  ): Promise<HistorialPagosReporte> {
    try {
      const pagos = await this.pagoRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.facturaVenta',  'fv')
        .leftJoinAndSelect('fv.client',       'c')
        .leftJoinAndSelect('p.facturaCompra', 'fc')
        .leftJoinAndSelect('fc.proveedor',    'pr')
        .leftJoinAndSelect('p.cuentaBancaria','cb')
        .leftJoinAndSelect('p.creadoPor',     'u')
        .where('p.fecha BETWEEN :inicio AND :fin', {
          inicio: fechaInicio,
          fin:    fechaFin,
        })
        .orderBy('p.fecha', 'DESC')
        .getMany();

      let totalCobros = 0;
      let totalPagos  = 0;

      const items = pagos.map(p => {
        const esCobro   = p.tipo === TipoPago.COBRO;
        const documento = esCobro
          ? p.facturaVenta?.comprobante_completo  ?? '—'
          : p.facturaCompra?.numero               ?? '—';
        const contraparte = esCobro
          ? p.facturaVenta.client.razonSocial?.trim() || ((p.facturaVenta.client.nombre ?? '') + ' ' + (p.facturaVenta.client.apellido ?? ''))
          : p.facturaCompra.proveedor.razonSocial?.trim() || ((p.facturaCompra.proveedor?.nombre ?? '') + ' ' + (p.facturaCompra.proveedor?.apellido ?? ''));

        if (esCobro) totalCobros += p.monto;
        else         totalPagos  += p.monto;

        return {
          id:              p.id,
          tipo:            p.tipo,
          fecha:           p.fecha,
          monto:           p.monto,
          medioPago:       p.medioPago,
          referencia:      p.referencia,
          numeroDocumento: documento,
          contraparte,
          asientoId:       p.asientoId,
        };
      });

      return {
        pagos: items,
        totalCobros,
        totalPagos,
        neto: totalCobros - totalPagos,
      };
    } catch (error) {
      this.logger.error(`Error historial pagos: ${error.message}`);
      throw new InternalServerErrorException('Error al generar historial de pagos');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // RESUMEN GENERAL — widget del dashboard
  // ══════════════════════════════════════════════════════════════
  async resumenCartera(): Promise<ResumenCartera> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [ventasActivas, comprasActivas] = await Promise.all([
      this.facturaVentaRepo
        .createQueryBuilder('f')
        .where('f.formaPago = :fp', { fp: FormaPago.CREDITO })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.paymentStatus IN (:...ps)', {
          ps: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.status NOT IN (:...exc)', {
          exc: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
        })
        .getMany(),

      this.facturaCompraRepo
        .createQueryBuilder('f')
        .where('f.formaPago = :fp', { fp: 'CREDITO' })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.paymentStatus IN (:...ps)', {
          ps: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.estado NOT IN (:...exc)', {
          exc: [GastoEstado.ANULADO, GastoEstado.BORRADOR],
        })
        .getMany(),
    ]);

    const calcular = (items: Array<{ saldoPendiente: number; fechaVencimiento: Date | null }>) => {
      let total = 0, porVencer = 0, vencida = 0;
      for (const item of items) {
        total += item.saldoPendiente;
        const venc = item.fechaVencimiento ? new Date(item.fechaVencimiento) : null;
        if (!venc || venc >= hoy) porVencer += item.saldoPendiente;
        else                       vencida   += item.saldoPendiente;
      }
      return { total, porVencer, vencida, cantidadFacturas: items.length };
    };

    return {
      cxc: calcular(ventasActivas),
      cxp: calcular(comprasActivas),
    };
  }

  // ══════════════════════════════════════════════════════════════
  // HELPER — construir estructura de aging desde filas normalizadas
  // ══════════════════════════════════════════════════════════════
  private construirAgingReporte(
    filas: Array<{
      id:            string;
      numero:        string;
      contraparteId: string;
      contraparte:   string;
      emision:       Date;
      vencimiento:   Date | null;
      total:         number;
      pagado:        number;
      saldo:         number;
      paymentStatus: PaymentStatus;
    }>,
  ): AgingReporte {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const mapaGrupos = new Map<string, AgingGroup>();

    const totales = { porVencer: 0, de1a30: 0, de31a60: 0, de61a90: 0, mas90: 0, total: 0 };

    for (const f of filas) {
      const dias   = this.calcularDias(f.vencimiento, hoy);
      const bucket = this.bucket(dias);

      const row: AgingRow = {
        id:            f.id,
        numero:        f.numero,
        contraparte:   f.contraparte,
        emision:       f.emision,
        vencimiento:   f.vencimiento,
        diasVencida:   dias,
        total:         f.total,
        pagado:        f.pagado,
        saldo:         f.saldo,
        paymentStatus: f.paymentStatus,
        bucket,
      };

      if (!mapaGrupos.has(f.contraparteId)) {
        mapaGrupos.set(f.contraparteId, {
          contraparteId:     f.contraparteId,
          contraparteNombre: f.contraparte,
          porVencer: 0, de1a30: 0, de31a60: 0, de61a90: 0, mas90: 0, total: 0,
          facturas: [],
        });
      }

      const grupo = mapaGrupos.get(f.contraparteId)!;
      grupo[bucket] += f.saldo;
      grupo.total   += f.saldo;
      grupo.facturas.push(row);

      totales[bucket] += f.saldo;
      totales.total   += f.saldo;
    }

    return {
      grupos:     Array.from(mapaGrupos.values()),
      totales,
      generadoEn: new Date(),
    };
  }

  private calcularDias(vencimiento: Date | null, hoy: Date): number {
    if (!vencimiento) return 0;
    const v = new Date(vencimiento);
    v.setHours(0, 0, 0, 0);
    return Math.floor((hoy.getTime() - v.getTime()) / 86_400_000);
  }

  private bucket(dias: number): AgingRow['bucket'] {
    if (dias <= 0)  return 'porVencer';
    if (dias <= 30) return 'de1a30';
    if (dias <= 60) return 'de31a60';
    if (dias <= 90) return 'de61a90';
    return 'mas90';
  }
}