import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { NominaJob, EstadoNominaJob } from './entities/nomina-job.entity';
import { Repository } from 'typeorm';
import { NominaService } from './nomina.service';

@Injectable()
export class NominaJobsService {
  private readonly logger = new Logger(NominaJobsService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(NominaJob)
    private readonly nominaJobRepo: Repository<NominaJob>,
    private readonly nominaService: NominaService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const job = await this.nominaJobRepo.findOne({
        where: { estado: EstadoNominaJob.PENDIENTE },
        order: { createdAt: 'ASC' },
      });

      if (!job) {
        this.isProcessing = false;
        return;
      }

      this.logger.log(`Procesando Job de Nómina: ${job.id} para período ${job.periodoId}`);
      
      // Update state to PROCESANDO
      job.estado = EstadoNominaJob.PROCESANDO;
      await this.nominaJobRepo.save(job);

      try {
        if (job.tipo === 'LIQUIDACION') {
          await this.nominaService.procesarLiquidacionAsincrona(job.periodoId, job.userId);
        }
        
        job.estado = EstadoNominaJob.COMPLETADO;
        await this.nominaJobRepo.save(job);
        this.logger.log(`Job ${job.id} completado con éxito.`);
      } catch (error: any) {
        this.logger.error(`Error procesando Job ${job.id}:`, error.stack);
        job.estado = EstadoNominaJob.FALLIDO;
        job.errores = { message: error.message, stack: error.stack };
        await this.nominaJobRepo.save(job);
      }
    } catch (error) {
      this.logger.error('Error in processPendingJobs cron', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
