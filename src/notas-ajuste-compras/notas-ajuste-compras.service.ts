import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotaAjusteCompra } from './entities/notas-ajuste-compra.entity';
import { ItemNotaAjusteCompra } from './entities/items-notas-ajuste-compra.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { CreateNotasAjusteCompraDto } from './dto/create-notas-ajuste-compra.dto';
import { TipoNotaCompra, EstadoNotaCompra } from './enums/notas-ajuste-compra.enum';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { PaymentStatus } from 'src/pagos/enums/pago.enum';

@Injectable()
export class NotasAjusteComprasService {
  private readonly logger = new Logger(NotasAjusteComprasService.name);

  constructor(
    @InjectRepository(NotaAjusteCompra)
    private readonly notaRepository: Repository<NotaAjusteCompra>,
    @InjectRepository(ItemNotaAjusteCompra)
    private readonly itemRepository: Repository<ItemNotaAjusteCompra>,
    @InjectRepository(FacturaCompra)
    private readonly facturaRepository: Repository<FacturaCompra>,
    private readonly asientosContablesService: AsientosContablesService,
    private readonly dataSource: DataSource
  ) {}

  async crearNotaCredito(dto: CreateNotasAjusteCompraDto, userId: string) {
    return this.crearNota(dto, userId, TipoNotaCompra.CREDITO);
  }

  async crearNotaDebito(dto: CreateNotasAjusteCompraDto, userId: string) {
    return this.crearNota(dto, userId, TipoNotaCompra.DEBITO);
  }

  private async crearNota(dto: CreateNotasAjusteCompraDto, userId: string, tipo: TipoNotaCompra) {
    const factura = await this.facturaRepository.findOne({
      where: { id: dto.facturaOriginalId },
      relations: ['proveedor']
    });

    if (!factura) {
      throw new NotFoundException(`Factura de compra con ID ${dto.facturaOriginalId} no encontrada`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nota = this.notaRepository.create({
        tipo,
        prefijo: tipo === TipoNotaCompra.CREDITO ? 'NCC' : 'NDC',
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.numero || '',
        proveedorId: factura.proveedorId,
        motivo: dto.motivo,
        formaPago: dto.formaPago,
        metodoPago: dto.metodoPago,
        fecha: new Date(dto.fecha),
        subtotal: dto.subtotal || 0,
        iva: dto.iva || 0,
        descuento: dto.descuento || 0,
        total: dto.total || 0,
        saldoPendiente: dto.total || 0,
        estado: EstadoNotaCompra.DRAFT,
        observaciones: dto.observaciones,
        createdById: userId
      });

      const notaGuardada = await queryRunner.manager.save(NotaAjusteCompra, nota);

      for (const itemDto of dto.items) {
        const item = this.itemRepository.create({
          notaId: notaGuardada.id,
          articuloId: itemDto.articuloId,
          cantidad: itemDto.cantidad,
          valorUnitario: itemDto.valorUnitario,
          porcentajeIVA: itemDto.porcentajeIVA || 0,
          descuento: itemDto.descuento || 0,
          subtotal: itemDto.subtotal,
          total: itemDto.total,
          valorDescuento: 0,
          valorIVA: 0
        });
        await queryRunner.manager.save(ItemNotaAjusteCompra, item);
      }

      await queryRunner.commitTransaction();
      return this.findOne(notaGuardada.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al crear nota de ajuste compra: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: string) {
    const nota = await this.notaRepository.findOne({
      where: { id },
      relations: ['proveedor', 'items', 'items.articulo', 'facturaOriginal']
    });

    if (!nota) {
      throw new NotFoundException(`Nota de ajuste con ID ${id} no encontrada`);
    }

    return nota;
  }

  async findAll(filtros: any) {
    const query = this.notaRepository.createQueryBuilder('nota')
      .leftJoinAndSelect('nota.proveedor', 'proveedor')
      .leftJoinAndSelect('nota.facturaOriginal', 'facturaOriginal');

    if (filtros.tipo) {
      query.andWhere('nota.tipo = :tipo', { tipo: filtros.tipo });
    }
    if (filtros.estado) {
      query.andWhere('nota.estado = :estado', { estado: filtros.estado });
    }
    if (filtros.facturaNumero) {
      query.andWhere('nota.facturaOriginalNumero ILIKE :facturaNumero', { facturaNumero: `%${filtros.facturaNumero}%` });
    }

    query.orderBy('nota.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page: 1,
        lastPage: 1
      }
    };
  }

  async registrar(id: string, userId: string) {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.DRAFT) {
      throw new BadRequestException('Solo se pueden registrar notas en estado borrador');
    }

    const factura = await this.facturaRepository.findOne({
      where: { id: nota.facturaOriginalId }
    });

    if (!factura) {
      throw new NotFoundException('Factura original no encontrada');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generar número consecutivo
      const count = await queryRunner.manager.count(NotaAjusteCompra, {
        where: { tipo: nota.tipo, estado: EstadoNotaCompra.ISSUED }
      });
      nota.numero = (count + 1).toString().padStart(8, '0');
      nota.numeroCompleto = `${nota.prefijo}-${nota.numero}`;
      nota.estado = EstadoNotaCompra.ISSUED;

      // Actualizar la factura original si es nota crédito
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        factura.saldoPendiente = Number(factura.saldoPendiente) - Number(nota.total);
        if (factura.saldoPendiente < 0) {
           factura.saldoPendiente = 0; 
        }

        if (factura.saldoPendiente <= 0) {
          factura.paymentStatus = PaymentStatus.PAID;
        }

        await queryRunner.manager.save(FacturaCompra, factura);
      } else if (nota.tipo === TipoNotaCompra.DEBITO) {
        factura.saldoPendiente = Number(factura.saldoPendiente) + Number(nota.total);
        if (factura.saldoPendiente > 0 && factura.paymentStatus === PaymentStatus.PAID) {
          factura.paymentStatus = PaymentStatus.PARTIAL;
        }
        await queryRunner.manager.save(FacturaCompra, factura);
      }

      const notaGuardada = await queryRunner.manager.save(NotaAjusteCompra, nota);

      await queryRunner.commitTransaction();

      // Generar asiento contable
      try {
        if (typeof this.asientosContablesService.generarAsientoNotaAjusteCompra === 'function') {
           await this.asientosContablesService.generarAsientoNotaAjusteCompra(notaGuardada.id);
        }
      } catch (error) {
        this.logger.error(`Error generando asiento contable para nota compra ${nota.id}: ${error.message}`);
        await this.notaRepository.update(notaGuardada.id, {
          estado: EstadoNotaCompra.ERROR_ASIENTO,
          asientoError: error.message,
          fechaAsientoError: new Date()
        });
      }

      return this.findOne(notaGuardada.id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al registrar nota de ajuste compra: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async anular(id: string, motivo: string) {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.ISSUED) {
      throw new BadRequestException('Solo se pueden anular notas registradas');
    }

    const factura = await this.facturaRepository.findOne({
      where: { id: nota.facturaOriginalId }
    });

    if (!factura) {
      throw new NotFoundException('Factura original no encontrada');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      nota.estado = EstadoNotaCompra.CANCELLED;
      nota.observaciones = `${nota.observaciones ? nota.observaciones + '\n' : ''}Anulada: ${motivo}`;

      if (nota.tipo === TipoNotaCompra.CREDITO) {
        factura.saldoPendiente = Number(factura.saldoPendiente) + Number(nota.total);
        if (factura.saldoPendiente > 0 && factura.paymentStatus === PaymentStatus.PAID) {
           factura.paymentStatus = PaymentStatus.PARTIAL;
        }
      } else {
        factura.saldoPendiente = Number(factura.saldoPendiente) - Number(nota.total);
        if (factura.saldoPendiente <= 0) {
           factura.saldoPendiente = 0;
           factura.paymentStatus = PaymentStatus.PAID;
        }
      }
      
      await queryRunner.manager.save(FacturaCompra, factura);
      await queryRunner.manager.save(NotaAjusteCompra, nota);

      await queryRunner.commitTransaction();

      // Anular asiento contable
      try {
         if (typeof this.asientosContablesService.generarAsientoAnulacionNotaAjusteCompra === 'function') {
            await this.asientosContablesService.generarAsientoAnulacionNotaAjusteCompra(nota.id);
         }
      } catch (e) {
         this.logger.error('Error anulando asiento', e);
      }

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
