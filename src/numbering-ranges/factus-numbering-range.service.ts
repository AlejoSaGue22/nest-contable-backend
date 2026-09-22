import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { FactusAuthService } from 'src/api-dian/services/factus-auth.service';
import {
  FactusNumberingRange,
  NumberingRangeDomain,
} from './entities/factus-numbering-range.entity';

export interface ResolveRangeOptions {
  domain?: NumberingRangeDomain;
  /** Empresa futura (multi-empresa). Hoy siempre global (null). */
  empresaId?: string | null;
}

export interface ListRangesFilter {
  domain?: NumberingRangeDomain;
  document?: string;
  isActive?: boolean;
  empresaId?: string | null;
}

interface MemoryEntry {
  ranges: FactusNumberingRange[];
  expiresAt: number;
}

/** Snapshot del rango usado en una emisión (se persiste en el documento). */
export interface NumberingRangeSnapshot {
  id: number;
  resolutionNumber: string | null;
  prefix: string | null;
}

/**
 * Caché de rangos de numeración DIAN (Factus V2).
 *
 * Estrategia (volumen 10-50 docs/día):
 * - Memoria TTL 30 min → 0 I/O en régimen normal.
 * - BD con stale-while-revalidate: billing 6h, payroll 12h.
 * - Si el caché supera 24h sin sincronizar, la emisión espera un sync
 *   (timeout 15s); si Factus cae, se sirve el dato stale y se registra alerta.
 * - Deduplicación: N emisiones concurrentes comparten un único fetch.
 * - Sin rango vigente → se BLOQUEA la emisión con mensaje guiado (decisión
 *   de negocio: nunca emitir sin resolución DIAN válida).
 */
@Injectable()
export class FactusNumberingRangeService {
  private readonly logger = new Logger(FactusNumberingRangeService.name);

  private static readonly MEMORY_TTL_MS = 30 * 60 * 1000;
  private static readonly STALE_AFTER_MS: Record<NumberingRangeDomain, number> = {
    billing: 6 * 60 * 60 * 1000,
    payroll: 12 * 60 * 60 * 1000,
  };
  private static readonly FORCE_SYNC_AFTER_MS = 24 * 60 * 60 * 1000;
  private static readonly SYNC_TIMEOUT_MS = 15000;

  private readonly memory = new Map<NumberingRangeDomain, MemoryEntry>();
  private readonly syncInFlight = new Map<NumberingRangeDomain, Promise<FactusNumberingRange[]>>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly authService: FactusAuthService,
    @InjectRepository(FactusNumberingRange)
    private readonly rangeRepository: Repository<FactusNumberingRange>,
  ) { }

  // ========== RESOLUCIÓN (ruta caliente de emisión: 0 llamadas Factus) ==========

  /**
   * Resolver el rango a usar en un payload de emisión:
   * 1. Variable de entorno (configKey) si está definida.
   * 2. Primer rango activo y vigente del caché (determinístico).
   * 3. Si no hay ninguno vigente → BadRequestException con guía (bloquea emisión).
   */
  async resolveId(
    configKey: string,
    documentCode?: string,
    options: ResolveRangeOptions = {},
  ): Promise<number> {
    return (await this.resolveSnapshot(configKey, documentCode, options)).id;
  }

  /**
   * Igual que resolveId pero devuelve el snapshot (id + resolución + prefijo)
   * para guardarlo en el documento emitido (auditoría/conciliación DIAN).
   */
  async resolveSnapshot(
    configKey: string,
    documentCode?: string,
    options: ResolveRangeOptions = {},
  ): Promise<NumberingRangeSnapshot> {
    const domain = options.domain ?? 'billing';

    const rawRangeId = this.configService.get<string | number>(configKey);
    if (rawRangeId !== undefined && rawRangeId !== null && String(rawRangeId).trim() !== '') {
      const parsed = Number(rawRangeId);
      const id = Number.isNaN(parsed) ? Number(rawRangeId) : parsed;
      const cached = await this.findCached(domain, Number(id)).catch(() => null);
      return {
        id,
        resolutionNumber: cached?.resolutionNumber ?? null,
        prefix: cached?.prefix ?? null,
      };
    }

    const ranges = await this.getRanges(
      { domain, document: documentCode, empresaId: options.empresaId ?? null },
      false,
    );

    const now = new Date();
    const vigentes = ranges.filter((r) => this.estaVigente(r, now));

    if (vigentes.length === 0) {
      throw new BadRequestException(
        `No hay rango de numeración DIAN vigente para ${this.describeTarget(domain, documentCode)}. ` +
        `Registre una resolución en Factus y sincronice desde Configuración > Rangos DIAN ` +
        `(POST /api/v1/numbering-ranges/sync con {"domain":"${domain}"}).`,
      );
    }

    // Determinístico: vence primero, luego menor consecutivo actual.
    vigentes.sort((a, b) => {
      const aExp = a.validTo ? a.validTo.getTime() : Number.MAX_SAFE_INTEGER;
      const bExp = b.validTo ? b.validTo.getTime() : Number.MAX_SAFE_INTEGER;
      if (aExp !== bExp) return aExp - bExp;
      return (a.currentNumber ?? 0) - (b.currentNumber ?? 0);
    });

    if (vigentes.length > 1) {
      this.logger.log(
        `ℹ️ ${vigentes.length} rangos vigentes para ${this.describeTarget(domain, documentCode)}; usando ${vigentes[0].factusId} (res. ${vigentes[0].resolutionNumber ?? 's/n'})`,
      );
    }

    const elegido = vigentes[0];
    // Auditoría de uso (fire-and-forget: no bloquea la emisión).
    void this.markUsed(elegido.id).catch((e) =>
      this.logger.warn(`No se pudo marcar uso del rango ${elegido.factusId}: ${e.message}`),
    );
    return {
      id: elegido.factusId,
      resolutionNumber: elegido.resolutionNumber,
      prefix: elegido.prefix,
    };
  }

  private describeTarget(domain: NumberingRangeDomain, documentCode?: string): string {
    if (domain === 'payroll') return 'nómina electrónica';
    if (documentCode === '01') return 'factura electrónica (documento 01)';
    if (documentCode === 'NC') return 'nota crédito';
    if (documentCode === 'ND') return 'nota débito';
    if (documentCode) return `documento ${documentCode}`;
    return 'notas crédito/débito';
  }

  private estaVigente(r: FactusNumberingRange, now: Date): boolean {
    if (!r.isActive || r.isExpired) return false;
    if (r.validTo && new Date(r.validTo).getTime() < now.getTime()) return false;
    if (r.validFrom && new Date(r.validFrom).getTime() > now.getTime()) return false;
    return true;
  }

  private async markUsed(id: string): Promise<void> {
    await this.rangeRepository.update({ id }, { lastUsedAt: new Date() });
  }

  // ========== LECTURA CON CACHÉ ==========

  /**
   * Obtener rangos del caché (memoria → BD). Solo sincroniza contra Factus
   * si no hay datos o si `forceRefresh` es true; en los demás casos el sync
   * corre en background (stale-while-revalidate).
   */
  async getRanges(filter: ListRangesFilter = {}, forceRefresh = false): Promise<FactusNumberingRange[]> {
    const domain = filter.domain ?? 'billing';

    if (forceRefresh) {
      await this.syncFromApi(domain);
      return this.filterRanges(this.readMemory(domain), filter);
    }

    const mem = this.memory.get(domain);
    if (mem && mem.expiresAt > Date.now() && mem.ranges.length > 0) {
      return this.filterRanges(mem.ranges, filter);
    }

    const dbRanges = await this.rangeRepository.find({
      where: { domain, empresaId: filter.empresaId ?? IsNull() } as any,
      order: { factusId: 'ASC' },
    });

    if (dbRanges.length === 0) {
      // Sin datos: sync sincrónico (primera vez o BD vacía).
      await this.syncFromApi(domain);
      return this.filterRanges(this.readMemory(domain), filter);
    }

    this.writeMemory(domain, dbRanges);

    const oldestSync = dbRanges.reduce<number | null>((min, r) => {
      if (!r.syncedAt) return 0;
      const t = new Date(r.syncedAt).getTime();
      return min === null ? t : Math.min(min, t);
    }, null);
    const ageMs = oldestSync === null ? Number.MAX_SAFE_INTEGER : Date.now() - oldestSync;

    if (ageMs > FactusNumberingRangeService.FORCE_SYNC_AFTER_MS) {
      // Caché muy viejo (>24h): intentar sync sincrónico; si Factus cae, servir stale.
      try {
        await this.syncFromApi(domain);
        return this.filterRanges(this.readMemory(domain), filter);
      } catch (error) {
        this.logger.warn(
          `⚠️ Sync forzado de rangos ${domain} falló; sirviendo caché de hace ${Math.round(ageMs / 3600000)}h: ${error.message}`,
        );
      }
    } else if (ageMs > FactusNumberingRangeService.STALE_AFTER_MS[domain]) {
      // Stale leve: servir caché y refrescar en background (deduplicado).
      void this.syncFromApi(domain).catch((error) =>
        this.logger.warn(`⚠️ Sync background de rangos ${domain} falló: ${error.message}`),
      );
    }

    return this.filterRanges(dbRanges, filter);
  }

  /** Lectura directa de BD para el panel administrativo. */
  async listCached(filter: ListRangesFilter = {}): Promise<FactusNumberingRange[]> {
    const rows = await this.rangeRepository.find({
      where: {
        ...(filter.domain ? { domain: filter.domain } : {}),
        ...(filter.empresaId !== undefined ? { empresaId: filter.empresaId } : {}),
      } as any,
      order: { domain: 'ASC', factusId: 'ASC' },
    });
    return this.filterRanges(rows, filter);
  }

  async findCached(domain: NumberingRangeDomain, factusId: number): Promise<FactusNumberingRange | null> {
    return await this.rangeRepository.findOne({ where: { domain, factusId } });
  }

  private filterRanges(ranges: FactusNumberingRange[], filter: ListRangesFilter): FactusNumberingRange[] {
    return ranges.filter((r) => {
      if (filter.document && String(r.document ?? '') !== String(filter.document)) return false;
      if (filter.isActive !== undefined && Boolean(r.isActive) !== filter.isActive) return false;
      return true;
    });
  }

  private readMemory(domain: NumberingRangeDomain): FactusNumberingRange[] {
    return this.memory.get(domain)?.ranges ?? [];
  }

  private writeMemory(domain: NumberingRangeDomain, ranges: FactusNumberingRange[]): void {
    this.memory.set(domain, {
      ranges,
      expiresAt: Date.now() + FactusNumberingRangeService.MEMORY_TTL_MS,
    });
  }

  /**
   * Invalidación reactiva: se llama cuando una emisión recibe 422 asociado
   * a rango/resolución/consecutivo. Limpia memoria y marca la BD como
   * pendiente de sync para que el próximo acceso refresque.
   */
  async invalidateCache(domain?: NumberingRangeDomain): Promise<void> {
    const domains: NumberingRangeDomain[] = domain ? [domain] : ['billing', 'payroll'];
    for (const d of domains) {
      this.memory.delete(d);
      await this.rangeRepository.update({ domain: d } as any, { syncedAt: null });
    }
    this.logger.warn(`🧹 Caché de rangos invalidado (${domains.join(',')}) por error de emisión`);
  }

  // ========== SINCRONIZACIÓN (único punto con llamadas a Factus) ==========

  /**
   * Sincronizar un dominio contra Factus. Deduplica llamadas concurrentes:
   * N peticiones simultáneas comparten un único GET.
   */
  async syncFromApi(domain: NumberingRangeDomain): Promise<FactusNumberingRange[]> {
    const inflight = this.syncInFlight.get(domain);
    if (inflight) {
      this.logger.debug(`⏳ Reutilizando sync en curso para rangos ${domain}`);
      return inflight;
    }

    const promise = this.doSync(domain).finally(() => {
      this.syncInFlight.delete(domain);
    });
    this.syncInFlight.set(domain, promise);
    return promise;
  }

  private endpointFor(domain: NumberingRangeDomain): string {
    const base = this.authService.getApiUrl();
    if (domain === 'payroll') {
      const payrollPath = this.configService.get<string>(
        'FACTUS_PAYROLL_NUMBERING_RANGES_PATH',
        '/v2/numbering-ranges/payrolls',
      );
      return `${base}${payrollPath}`;
    }
    return `${base}/v2/numbering-ranges`;
  }

  private async doSync(domain: NumberingRangeDomain): Promise<FactusNumberingRange[]> {
    const token = await this.authService.getToken();
    const url = this.endpointFor(domain);

    let raw: any[];
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          timeout: FactusNumberingRangeService.SYNC_TIMEOUT_MS,
        }),
      );
      const body = response.data?.data;
      raw = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    } catch (error) {
      const status = error.response?.status;
      this.logger.error(
        `❌ Sync de rangos ${domain} falló (${status ?? 'sin respuesta'}):`,
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        `No se pudo sincronizar rangos de ${domain === 'payroll' ? 'nómina' : 'facturación'} con Factus${status ? ` (HTTP ${status})` : ''}. ` +
        `Verifique credenciales y el endpoint ${url}.`,
      );
    }

    const now = new Date();
    const entities: FactusNumberingRange[] = [];
    for (const item of raw) {
      const factusId = Number(item?.id);
      if (!Number.isFinite(factusId)) continue;
      const existing = await this.rangeRepository.findOne({ where: { domain, factusId } });
      const entity = this.rangeRepository.create({
        ...(existing ?? {}),
        factusId,
        domain,
        empresaId: existing?.empresaId ?? null,
        ...this.mapApiItem(item),
        source: 'api',
        syncedAt: now,
        rawJson: item,
      });
      entities.push(await this.rangeRepository.save(entity));
    }

    this.writeMemory(domain, entities);
    this.logger.log(`🔄 Rangos ${domain} sincronizados: ${entities.length} registros`);
    this.checkAlerts(domain, entities);
    return entities;
  }

  /**
   * Mapeo tolerante del payload Factus (los nombres exactos varían por
   * ambiente/versión; se aceptan alias).
   */
  private mapApiItem(item: any): Partial<FactusNumberingRange> {
    const toNum = (v: any): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const toBool = (v: any, fallback: boolean): boolean => {
      if (v === null || v === undefined) return fallback;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') return ['1', 'true', 'yes', 'si', 'sí'].includes(v.toLowerCase());
      return fallback;
    };
    const toDate = (v: any): Date | null => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    return {
      document: this.normalizeDocument(
        item?.document ?? item?.document_code ?? item?.type_document_id ?? null,
      ),
      prefix: item?.prefix ?? null,
      resolutionNumber:
        item?.resolution_number ?? item?.resolution ?? item?.resolutionNumber ?? item?.resolution_text ?? null,
      technicalKey: item?.technical_key ?? item?.technicalKey ?? null,
      fromNumber: toNum(item?.from ?? item?.from_number ?? item?.start ?? item?.initial_number),
      toNumber: toNum(item?.to ?? item?.to_number ?? item?.end ?? item?.final_number),
      currentNumber: toNum(item?.current ?? item?.current_number ?? item?.consecutive),
      isActive: toBool(item?.is_active ?? item?.isActive, true),
      isExpired: toBool(item?.is_expired ?? item?.isExpired, false),
      validFrom: toDate(item?.valid_from ?? item?.start_date ?? item?.initial_date),
      validTo: toDate(item?.valid_to ?? item?.end_date ?? item?.expiration_date ?? item?.final_date),
    };
  }

  /**
   * Normaliza el campo `document` de Factus a un código interno estable.
   * La API devuelve nombres ("Factura de Venta", "Nota Crédito", ...) y no
   * códigos, así que se mapea por contenido (insensible a tildes/mayúsculas).
   * Códigos: '01' FE, 'NC' nota crédito, 'ND' nota débito,
   * 'DS' documento soporte, 'NA' nota ajuste doc. soporte.
   */
  private normalizeDocument(value: any): string | null {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).trim();
    if (/^\d{2}$/.test(raw)) return raw;
    const norm = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (norm.includes('nota de ajuste')) return 'NA';
    if (norm.includes('nota credito')) return 'NC';
    if (norm.includes('nota debito')) return 'ND';
    if (norm.includes('documento soporte')) return 'DS';
    if (norm.includes('factura')) return '01';
    if (norm.includes('nomina')) return 'NOM';
    return raw;
  }

  /** Alertas financieras/contables: agotamiento y vencimiento. */
  private checkAlerts(domain: NumberingRangeDomain, ranges: FactusNumberingRange[]): void {
    const now = Date.now();
    for (const r of ranges) {
      if (!r.isActive || r.isExpired) continue;
      const label = `rango ${r.factusId}${r.prefix ? ` (${r.prefix})` : ''} res.${r.resolutionNumber ?? 's/n'} [${domain}]`;
      if (r.fromNumber !== null && r.toNumber !== null && r.currentNumber !== null) {
        const total = r.toNumber - r.fromNumber + 1;
        const remaining = r.toNumber - r.currentNumber;
        if (total > 0 && (remaining / total <= 0.1 || remaining <= 50)) {
          this.logger.warn(
            `⚠️ Numeración por agotarse: ${label} — quedan ${remaining} de ${total}. Solicite nueva resolución DIAN.`,
          );
        }
      }
      if (r.validTo) {
        const days = Math.ceil((new Date(r.validTo).getTime() - now) / 86400000);
        if (days >= 0 && days <= 30) {
          this.logger.warn(`⚠️ Resolución por vencer: ${label} — vence en ${days} días (${r.validTo}).`);
        }
      }
    }
  }

  // ========== OPERACIONES PROXY (portal Factus sigue siendo el editor) ==========

  /** Crear rango en Factus y sincronizarlo al caché. */
  async createInFactus(domain: NumberingRangeDomain, payload: Record<string, unknown>): Promise<FactusNumberingRange> {
    const token = await this.authService.getToken();
    let created: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.endpointFor(domain), payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: FactusNumberingRangeService.SYNC_TIMEOUT_MS,
        }),
      );
      created = response.data?.data ?? response.data;
    } catch (error) {
      if (error.response?.status === 422) {
        const errors = error.response.data?.errors || {};
        const mensajes = Object.values(errors).flat();
        throw new BadRequestException(`Datos inválidos para el rango: ${mensajes.join(', ')}`);
      }
      this.logger.error('❌ Error creando rango en Factus:', error.response?.data || error.message);
      throw new BadRequestException(error.response?.data?.message || 'Error al crear rango en Factus');
    }

    await this.syncFromApi(domain);
    const factusId = Number(created?.id);
    if (Number.isFinite(factusId)) {
      const found = await this.findCached(domain, factusId);
      if (found) return found;
    }
    throw new BadRequestException(
      'Rango creado en Factus pero no visible en el listado posterior. Sincronice manualmente.',
    );
  }

  /** Eliminar rango en Factus y purgarlo del caché. */
  async deleteInFactus(domain: NumberingRangeDomain, factusId: number): Promise<void> {
    const token = await this.authService.getToken();
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.endpointFor(domain)}/${factusId}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          timeout: FactusNumberingRangeService.SYNC_TIMEOUT_MS,
        }),
      );
      await this.rangeRepository.delete({ domain, factusId });
      this.memory.delete(domain);
      this.logger.log(`🗑️ Rango ${factusId} [${domain}] eliminado en Factus y purgado del caché`);
    } catch (error) {
      this.logger.error('❌ Error eliminando rango en Factus:', error.response?.data || error.message);
      throw new BadRequestException(error.response?.data?.message || 'Error al eliminar rango en Factus');
    }
  }

  /** Cambiar estado (activo/inactivo) en Factus y refrescar el registro. */
  async toggleStatus(domain: NumberingRangeDomain, factusId: number): Promise<FactusNumberingRange> {
    const token = await this.authService.getToken();
    try {
      await firstValueFrom(
        this.httpService.patch(`${this.endpointFor(domain)}/${factusId}/toggle-status`, {}, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: FactusNumberingRangeService.SYNC_TIMEOUT_MS,
        }),
      );
      return await this.refreshOne(domain, factusId);
    } catch (error) {
      this.logger.error('❌ Error cambiando estado del rango:', error.response?.data || error.message);
      throw new BadRequestException(error.response?.data?.message || 'Error al cambiar estado del rango en Factus');
    }
  }

  /** Actualizar consecutivo en Factus y refrescar el registro. */
  async updateCurrent(
    domain: NumberingRangeDomain,
    factusId: number,
    body: Record<string, unknown>,
  ): Promise<FactusNumberingRange> {
    const token = await this.authService.getToken();
    try {
      await firstValueFrom(
        this.httpService.patch(`${this.endpointFor(domain)}/${factusId}/current`, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: FactusNumberingRangeService.SYNC_TIMEOUT_MS,
        }),
      );
      return await this.refreshOne(domain, factusId);
    } catch (error) {
      this.logger.error('❌ Error actualizando consecutivo del rango:', error.response?.data || error.message);
      throw new BadRequestException(error.response?.data?.message || 'Error al actualizar consecutivo en Factus');
    }
  }

  /** Ver un rango en Factus y actualizar el caché local. */
  async refreshOne(domain: NumberingRangeDomain, factusId: number): Promise<FactusNumberingRange> {
    const token = await this.authService.getToken();
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.endpointFor(domain)}/${factusId}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          timeout: FactusNumberingRangeService.SYNC_TIMEOUT_MS,
        }),
      );
      const item = response.data?.data ?? response.data;
      const existing = await this.rangeRepository.findOne({ where: { domain, factusId } });
      const entity = this.rangeRepository.create({
        ...(existing ?? {}),
        factusId,
        domain,
        empresaId: existing?.empresaId ?? null,
        ...this.mapApiItem(item),
        source: 'api',
        syncedAt: new Date(),
        rawJson: item,
      });
      const saved = await this.rangeRepository.save(entity);
      this.memory.delete(domain);
      return saved;
    } catch (error) {
      this.logger.error('❌ Error consultando rango en Factus:', error.response?.data || error.message);
      throw new BadRequestException(error.response?.data?.message || 'Error al consultar rango en Factus');
    }
  }
}
