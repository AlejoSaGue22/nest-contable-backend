import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FactusNumberingRangeService } from './factus-numbering-range.service';
import { NumberingRangeDomain } from './entities/factus-numbering-range.entity';

/**
 * Sincronización programada de rangos DIAN.
 * - billing cada 6h, payroll cada 12h (America/Bogota).
 * - Primer sync diferido 10s tras el arranque (no bloquea el boot).
 * Los fallos solo se registran: la emisión sigue servida desde el caché.
 */
@Injectable()
export class NumberingRangesScheduler implements OnModuleInit {
  private readonly logger = new Logger(NumberingRangesScheduler.name);

  constructor(private readonly rangeService: FactusNumberingRangeService) {}

  onModuleInit() {
    setTimeout(() => {
      void this.syncSafely('billing');
      void this.syncSafely('payroll');
    }, 10000);
  }

  @Cron('0 */6 * * *', { name: 'sync-numbering-ranges-billing', timeZone: 'America/Bogota' })
  async syncBilling() {
    await this.syncSafely('billing');
  }

  @Cron('0 */12 * * *', { name: 'sync-numbering-ranges-payroll', timeZone: 'America/Bogota' })
  async syncPayroll() {
    await this.syncSafely('payroll');
  }

  private async syncSafely(domain: NumberingRangeDomain): Promise<void> {
    try {
      const ranges = await this.rangeService.syncFromApi(domain);
      this.logger.log(`[Cron] Rangos ${domain} sincronizados: ${ranges.length}`);
    } catch (error) {
      this.logger.warn(`[Cron] Sync de rangos ${domain} omitido: ${error.message}`);
    }
  }
}
