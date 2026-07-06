import { Injectable, OnModuleInit, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AsientosContablesService } from '../asientos-contables.service';
import { IContabilizacionStrategy } from './contabilizacion-strategy.interface';
import { DefinicionAsientoDto } from '../dto/definicion-asiento.dto';
import { AsientoContable } from '../entities/asientos-contable.entity';
import { NotaAjusteStrategy } from './strategies/nota-ajuste.strategy';
import { FacturaVentaStrategy } from './strategies/factura-venta.strategy';
import { FacturaCompraStrategy } from './strategies/factura-compra.strategy';


@Injectable()
export class ContabilizacionEngine implements OnModuleInit {
  private readonly logger = new Logger(ContabilizacionEngine.name);
  private readonly strategiesMap = new Map<string, IContabilizacionStrategy>();

  constructor(
    private readonly asientosService: AsientosContablesService,
    private readonly dataSource: DataSource,
    private readonly notaAjusteStrategy: NotaAjusteStrategy,
    private readonly facturaVentaStrategy: FacturaVentaStrategy,
    private readonly facturaCompraStrategy: FacturaCompraStrategy,
  ) { }

  onModuleInit() {
    this.strategiesMap.set(this.notaAjusteStrategy.tipoDocumento, this.notaAjusteStrategy);
    this.strategiesMap.set(this.facturaVentaStrategy.tipoDocumento, this.facturaVentaStrategy);
    this.strategiesMap.set(this.facturaCompraStrategy.tipoDocumento, this.facturaCompraStrategy);
    this.logger.log('Motor de Contabilización inicializado con estrategias registradas.');
  }

  /**
   * Resuelve la estrategia para un tipo de documento.
   */
  private getStrategy(tipoDocumento: string): IContabilizacionStrategy {
    const strategy = this.strategiesMap.get(tipoDocumento);
    if (!strategy) {
      throw new NotFoundException(`No existe una estrategia de contabilización para el tipo: ${tipoDocumento}`);
    }
    return strategy;
  }

  /**
   * MODO SIMULACIÓN: Genera la vista previa en memoria del asiento contable.
   */
  async previsualizarAsiento(
    tipoDocumento: string,
    documentoId: string
  ): Promise<DefinicionAsientoDto> {
    const strategy = this.getStrategy(tipoDocumento);
    return strategy.generarDefinicion(documentoId);
  }

  /**
   * MODO CONTABILIZACIÓN: Genera y persiste transaccionalmente el asiento contable definitivo.
   * Si se proporciona un queryRunner, se asume que la transacción se maneja externamente.
   */
  async contabilizarDocumento(tipoDocumento: string, documentoId: string, userId: string, queryRunner?: QueryRunner,): Promise<AsientoContable> {
    const strategy = this.getStrategy(tipoDocumento);
    const mustManageTransaction = !queryRunner;
    const qr = queryRunner || this.dataSource.createQueryRunner();

    if (mustManageTransaction) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      // Calcular la definición usando la transacción activa
      const definicion = await strategy.generarDefinicion(documentoId, qr);

      if (!definicion.estaBalanceado) {
        throw new BadRequestException(`No se puede contabilizar el documento. El asiento no está balanceado. Diferencia: ${definicion.diferencia}`);
      }

      // Persistir el asiento contable definitivo
      const asiento = await this.asientosService.crearAsientoDesdeDefinicion(definicion, userId, qr);

      if (mustManageTransaction) {
        await qr.commitTransaction();
      }
      return asiento;

    } catch (error: any) {
      if (mustManageTransaction) {
        await qr.rollbackTransaction();
      }
      this.logger.error(`Error al contabilizar documento [${tipoDocumento} - ${documentoId}]: ${error.message}`);
      throw error;

    } finally {
      if (mustManageTransaction) {
        await qr.release();
      }
    }
  }
}
