import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { NominaJob, EstadoNominaJob } from './entities/nomina-job.entity';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { NominaService } from './nomina.service';

@Injectable()
export class NominaJobsService {
  private readonly logger = new Logger(NominaJobsService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(NominaJob)
    private readonly nominaJobRepo: Repository<NominaJob>,
    private readonly nominaService: NominaService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingJobs() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const lockKey = 'contable:nomina:pending-jobs';

    try {
      const lockResult = await queryRunner.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        [lockKey],
      );
      if (!lockResult[0]?.locked) return;

      const job = await queryRunner.manager.findOne(NominaJob, {
        where: { estado: EstadoNominaJob.PENDIENTE },
        order: { createdAt: 'ASC' },
      });

      if (!job) return;

      this.logger.log(`Procesando Job de Nómina: ${job.id} para período ${job.periodoId}`);
      
      // Update state to PROCESANDO
      job.estado = EstadoNominaJob.PROCESANDO;
      await queryRunner.manager.save(NominaJob, job);

      try {
        if (job.tipo === 'LIQUIDACION') {
          await this.nominaService.procesarLiquidacionAsincrona(job.periodoId, job.userId);
        }
        
        job.estado = EstadoNominaJob.COMPLETADO;
         await queryRunner.manager.save(NominaJob, job);
        this.logger.log(`Job ${job.id} completado con éxito.`);
      } catch (error: any) {
        this.logger.error(`Error procesando Job ${job.id}:`, error.stack);
        job.estado = EstadoNominaJob.FALLIDO;
        job.errores = { message: error.message, stack: error.stack };
         await queryRunner.manager.save(NominaJob, job);
      }
    } catch (error) {
      this.logger.error('Error in processPendingJobs cron', error);
    } finally {
      try {
        await queryRunner.query(
          'SELECT pg_advisory_unlock(hashtext($1))',
          [lockKey],
        );
      } finally {
        await queryRunner.release();
      }
      this.isProcessing = false;
    }
  }
}
