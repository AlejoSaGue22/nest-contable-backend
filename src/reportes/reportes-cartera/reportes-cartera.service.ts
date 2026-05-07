import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import { Pago } from 'src/pagos/entities/pago.entity';
import { PaymentStatus, TipoPago } from 'src/pagos/enums/pago.enum';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { FormaPago, InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { AgingGroup, AgingReporte, AgingRow, HistorialPagosReporte, ReporteAgingAgrupado, ResumenCartera } from './dto/reportes-cartera.dto';
import { NotaAjuste } from 'src/notas-ajuste/entities/notas-ajuste.entity';
import { TipoNota } from 'src/notas-ajuste/enums/notas-ajuste.enum';

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

    @InjectRepository(NotaAjuste)
    private readonly notaAjusteRepo: Repository<NotaAjuste>,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // AGING CxC — Antigüedad de cartera por cobrar
  // ══════════════════════════════════════════════════════════════
  async agingCobrar(): Promise<AgingReporte> {
    try {
      const facturas = await this.facturaVentaRepo
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.client', 'c')
        .where('f.formaPago = :fp',       { fp: FormaPago.CREDITO })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.paymentStatus IN (:...ps)', {
          ps: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.status NOT IN (:...exc)', {
          exc: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT],
        })
        .orderBy('f.fechaVencimiento', 'ASC')
        .getMany();

      return this.construirAgingReporte(
        facturas.map(f => ({
          id:            f.id,
          numero:        f.comprobante_completo,
          contraparteId: f.clientId,
          contraparte:   f.client?.razonSocial?.trim().length > 0 ? f.client.razonSocial : f.client.nombre + ' ' + f.client.apellido,
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
  async agingPagar(): Promise<AgingReporte> {
    try {
      const facturas = await this.facturaCompraRepo
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.proveedor', 'p')
        .where('f.formaPago = :fp',       { fp: 'CREDITO' })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.paymentStatus IN (:...ps)', {
          ps: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
        })
        .andWhere('f.estado NOT IN (:...exc)', {
          exc: [GastoEstado.ANULADO, GastoEstado.BORRADOR],
        })
        .orderBy('f.fechaVencimiento', 'ASC')
        .getMany();

      return this.construirAgingReporte(
        facturas.map(f => ({
          id:            f.id,
          numero:        f.numero || '—',
          contraparteId: f.proveedorId,
          contraparte:   f.proveedor.razonSocial?.trim() ? f.proveedor.razonSocial.trim() : `${f.proveedor.nombre} ${f.proveedor.apellido}`,
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

  async reporteAgingCobrar(fechaInicio: Date, fechaFin: Date): Promise<ReporteAgingAgrupado> {
    try {
      const facturas = await this.facturaVentaRepo
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.client', 'c')
        .where('f.formaPago = :fp', { fp: FormaPago.CREDITO })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.fecha BETWEEN :inicio AND :fin', { inicio: fechaInicio, fin: fechaFin })
        .andWhere('f.status NOT IN (:...exc)', { exc: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] })
        .orderBy('f.fecha', 'DESC')
        .getMany();

      // Buscar Notas de Crédito con saldo a favor del cliente
      const notasCredito = await this.notaAjusteRepo
        .createQueryBuilder('n')
        .leftJoinAndSelect('n.cliente', 'c')
        .where('n.tipo = :tipo', { tipo: TipoNota.CREDITO })
        .andWhere('n.saldoPendiente > 0')
        .andWhere('n.fecha BETWEEN :inicio AND :fin', { inicio: fechaInicio, fin: fechaFin })
        .getMany();

      return this.construirReporteAgrupado(facturas, notasCredito, 'client');
    } catch (error) {
      this.logger.error(`Error reporte aging CxC: ${error.message}`);
      throw new InternalServerErrorException('Error al generar reporte de antigüedad');
    }
  }

  async reporteAgingPagar(fechaInicio: Date, fechaFin: Date): Promise<ReporteAgingAgrupado> {
    try {
      const facturas = await this.facturaCompraRepo
        .createQueryBuilder('f')
        .leftJoinAndSelect('f.proveedor', 'p')
        .where('f.formaPago = :fp', { fp: 'CREDITO' })
        .andWhere('f.saldoPendiente > 0')
        .andWhere('f.fecha BETWEEN :inicio AND :fin', { inicio: fechaInicio, fin: fechaFin })
        .andWhere('f.estado NOT IN (:...exc)', { exc: [GastoEstado.ANULADO, GastoEstado.BORRADOR] })
        .orderBy('f.fecha', 'DESC')
        .getMany();

      // Por ahora no hay notas de ajuste mapeadas para proveedores en este módulo
      return this.construirReporteAgrupado(facturas, [], 'proveedor');
    } catch (error) {
      this.logger.error(`Error reporte aging CxP: ${error.message}`);
      throw new InternalServerErrorException('Error al generar reporte de antigüedad');
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

        console.log(p);

        return {
          id:              p.id,
          tipo:            p.tipo,
          fecha:           p.fecha,
          monto:           p.monto,
          medioPago:       p.medioPago,
          banco:           p.medioPago != 'caja' ? p.cuentaBancaria?.nombre : '',
          tipoCuenta:      p.medioPago != 'caja' ? p.cuentaBancaria?.tipoCuenta : '',
          numeroCuenta:    p.medioPago != 'caja' ? p.cuentaBancaria?.numeroCuenta : '',
          referencia:      p.referencia,
          numeroFactura: documento,
          contraparte,
          numeroContraparte: esCobro ? p.facturaVenta.client.numeroDocumento : p.facturaCompra.proveedor.identificacion,
          creadoPor:       p.creadoPor?.fullName || p.creadoPor?.email,
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

  private construirReporteAgrupado(facturas: any[], notas: NotaAjuste[], tipo: 'client' | 'proveedor'): ReporteAgingAgrupado {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const mapaGrupos = new Map<string, any>();

    // 1. Procesar Facturas (Deuda)
    for (const f of facturas) {
      const contraparte = tipo === 'client' ? f.client : f.proveedor;
      const id = contraparte.id;
      const identificacion = tipo === 'client' ? f.client.numeroDocumento : f.proveedor.identificacion;
      const nombre = tipo === 'client' 
        ? (f.client.razonSocial?.trim() || `${f.client.nombre ?? ''} ${f.client.apellido ?? ''}`.trim())
        : (f.proveedor.razonSocial?.trim() || `${f.proveedor.nombre ?? ''} ${f.proveedor.apellido ?? ''}`.trim());

      if (!mapaGrupos.has(id)) {
        mapaGrupos.set(id, {
          identificacion,
          sucursal: '0', // Valor por defecto o '—'
          nombre,
          deuda: 0,
          saldoFavor: 0,
          saldoCartera: 0,
          facturas: []
        });
      }

      const grupo = mapaGrupos.get(id);
      const saldo = Number(f.saldoPendiente);
      grupo.deuda += saldo;

      const venc = f.fechaVencimiento ? new Date(f.fechaVencimiento) : null;
      const esVencido = venc && venc < hoy;
      const dias = this.calcularDias(f.fechaVencimiento, hoy);

      grupo.facturas.push({
        id: f.id,
        fecha: f.fecha,
        vencimiento: f.fechaVencimiento,
        numeroFactura: f.comprobante_completo || f.numero || '—',
        saldo: saldo,
        diasVencidos: dias > 0 ? dias : 0,
        estado: esVencido ? 'Vencido' : 'Por Vencer'
      });
    }

    // 2. Procesar Notas (Saldo a favor)
    for (const n of notas) {
      const id = n.clienteId;
      if (!mapaGrupos.has(id)) {
        // Si el cliente no tiene facturas pero sí notas a favor
        const nombre = n.cliente.razonSocial?.trim() || `${n.cliente.nombre ?? ''} ${n.cliente.apellido ?? ''}`.trim();
        mapaGrupos.set(id, {
          identificacion: n.cliente.numeroDocumento,
          sucursal: '0',
          nombre,
          deuda: 0,
          saldoFavor: 0,
          saldoCartera: 0,
          facturas: []
        });
      }
      const grupo = mapaGrupos.get(id);
      grupo.saldoFavor += Number(n.saldoPendiente);
    }

    // 3. Finalizar cálculos y totales
    let totalDeuda = 0, totalSaldoFavor = 0, totalCartera = 0;
    const items = Array.from(mapaGrupos.values()).map(g => {
      g.saldoCartera = g.deuda - g.saldoFavor;
      
      totalDeuda += g.deuda;
      totalSaldoFavor += g.saldoFavor;
      totalCartera += g.saldoCartera;

      return g;
    });

    return {
      items,
      totales: { totalDeuda, totalSaldoFavor, totalCartera },
      generadoEn: new Date()
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