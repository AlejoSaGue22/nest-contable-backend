import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { NotaAjusteCompra } from './entities/notas-ajuste-compra.entity';
import { ItemNotaAjusteCompra } from './entities/items-notas-ajuste-compra.entity';
import { FacturaCompra, GastoEstado } from 'src/facturas-compras/entities/factura-compra.entity';
import { CreateNotasAjusteCompraDto } from './dto/create-notas-ajuste-compra.dto';
import { UpdateNotasAjusteCompraDto } from './dto/update-notas-ajuste-compra.dto';
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

    if (factura.estado !== GastoEstado.REGISTRADO) {
        throw new BadRequestException('Solo se pueden crear notas para facturas registradas');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validar que el total de la NC crédito no exceda el saldo de la factura
      if (tipo === TipoNotaCompra.CREDITO) {
        const totalNotasCredito = await this.calcularTotalNotasCredito(factura.id);
        const saldoDisponible = Number(factura.total) - totalNotasCredito;
        const totalNueva = Number(dto.total || 0);
        if (totalNueva > saldoDisponible) {
          throw new BadRequestException(`El total de la nota crédito ($${totalNueva}) excede el saldo disponible de la factura ($${saldoDisponible})`);
        }
      }

      const nota = this.notaRepository.create({
        tipo,
        prefijo: tipo === TipoNotaCompra.CREDITO ? 'NCC' : 'NDC',
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.numero || '',
        proveedorId: factura.proveedorId,
        motivo: dto.motivo,
        formaPago: dto.formaPago,
        metodoPago: dto.metodoPago,
        esReembolsoAbono: dto.esReembolsoAbono || false,
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
          impuestoId: itemDto.impuestoId,
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
      relations: ['proveedor', 'items', 'items.articulo', 'items.impuesto', 'facturaOriginal', 'createdBy']
    });

    if (!nota) {
      throw new NotFoundException(`Nota de ajuste con ID ${id} no encontrada`);
    }

    return nota;
  }

  async findAll(filtros: any) {
    const { page = 1, limit = 10 } = filtros;
    const skip = (page - 1) * limit;

    const query = this.notaRepository.createQueryBuilder('nota')
      .leftJoinAndSelect('nota.proveedor', 'proveedor')
      .leftJoinAndSelect('nota.facturaOriginal', 'facturaOriginal')
      .leftJoinAndSelect('nota.createdBy', 'createdBy');

    if (filtros.tipo) {
      query.andWhere('nota.tipo = :tipo', { tipo: filtros.tipo });
    }
    if (filtros.estado) {
      query.andWhere('nota.estado = :estado', { estado: filtros.estado });
    }
    if (filtros.facturaNumero) {
      query.andWhere('nota.facturaOriginalNumero ILIKE :facturaNumero', { facturaNumero: `%${filtros.facturaNumero}%` });
    }
    if (filtros.proveedorNombre) {
      query.andWhere('proveedor.razonSocial ILIKE :proveedorNombre', { proveedorNombre: `%${filtros.proveedorNombre}%` });
    }
    if (filtros.fechaInicio && filtros.fechaFin) {
      query.andWhere('nota.fecha BETWEEN :fechaInicio AND :fechaFin', {
        fechaInicio: filtros.fechaInicio,
        fechaFin: filtros.fechaFin
      });
    }

    query.orderBy('nota.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit)
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

    // Validar que el total de la NC crédito no exceda el saldo de la factura
    if (nota.tipo === TipoNotaCompra.CREDITO) {
      const totalNotasCredito = await this.calcularTotalNotasCredito(nota.facturaOriginalId);
      const saldoDisponible = Number(factura.total) - totalNotasCredito;

      if (Number(nota.total) > saldoDisponible) {
        throw new BadRequestException(`Esta nota crédito ($${Number(nota.total)}) excede el saldo disponible de la factura ($${saldoDisponible}).`);
      }
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

  async update(id: string, updateDto: UpdateNotasAjusteCompraDto): Promise<NotaAjusteCompra> {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.DRAFT) {
      throw new BadRequestException('Solo se pueden modificar notas en estado borrador');
    }

    // Validar saldo disponible si es NC crédito y cambia el total
    const nuevoTotal = Number(updateDto.total ?? nota.total);
    if (nota.tipo === TipoNotaCompra.CREDITO && nuevoTotal !== Number(nota.total)) {
      const factura = await this.facturaRepository.findOne({ where: { id: nota.facturaOriginalId } });
      if (!factura) throw new NotFoundException('Factura original no encontrada');
      const totalNotasCredito = await this.calcularTotalNotasCredito(nota.facturaOriginalId);
      // Excluir esta nota del cálculo (aún no se ha actualizado)
      const totalNotasExcluyendoEsta = totalNotasCredito - Number(nota.total);
      const saldoDisponible = Number(factura.total) - totalNotasExcluyendoEsta;
      if (nuevoTotal > saldoDisponible) {
        throw new BadRequestException(`El nuevo total ($${nuevoTotal}) excede el saldo disponible de la factura ($${saldoDisponible})`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let subtotal = Number(nota.subtotal);
      let iva = Number(nota.iva);
      let total = Number(nota.total);

      // Si se actualizan items, recalcular y reemplazar
      if (updateDto.items && updateDto.items.length > 0) {
        subtotal = Number(updateDto.subtotal || 0);
        iva = Number(updateDto.iva || 0);
        total = Number(updateDto.total || 0);

        // Eliminar items actuales
        await queryRunner.manager.delete(ItemNotaAjusteCompra, { notaId: id });

        // Crear nuevos items
        for (const itemDto of updateDto.items) {
          const item = this.itemRepository.create({
            notaId: id,
            articuloId: itemDto.articuloId,
            impuestoId: itemDto.impuestoId,
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
      }

      // Actualizar campos de la nota
      const updatePayload: any = {
        subtotal: Math.round(subtotal),
        iva: Math.round(iva),
        total: Math.round(total),
        saldoPendiente: Math.round(total)
      };

      if (updateDto.motivo) updatePayload.motivo = updateDto.motivo;
      if (updateDto.metodoPago) updatePayload.metodoPago = updateDto.metodoPago;
      if (updateDto.fecha) updatePayload.fecha = new Date(updateDto.fecha);
      if (updateDto.observaciones) updatePayload.observaciones = updateDto.observaciones;
      if (updateDto.esReembolsoAbono !== undefined) updatePayload.esReembolsoAbono = updateDto.esReembolsoAbono;
      if (updateDto.formaPago) updatePayload.formaPago = updateDto.formaPago;

      await queryRunner.manager.update(NotaAjusteCompra, { id }, updatePayload);
      await queryRunner.commitTransaction();

      return await this.findOne(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error actualizando nota compra ${id}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.DRAFT) {
      throw new BadRequestException('Solo se pueden eliminar notas en estado borrador');
    }

    await this.notaRepository.softDelete({ id });
    this.logger.log(`Nota de compra eliminada: ${nota.numeroCompleto || id}`);
  }

  private async calcularTotalNotasCredito(facturaId: string): Promise<number> {
    const notasCredito = await this.notaRepository.find({
      where: {
        facturaOriginalId: facturaId,
        tipo: TipoNotaCompra.CREDITO,
        estado: In([EstadoNotaCompra.ISSUED, EstadoNotaCompra.ERROR_ASIENTO])
      }
    });
    return notasCredito.reduce((sum, nota) => sum + Number(nota.total), 0);
  }

  async reintentarAsiento(id: string): Promise<NotaAjusteCompra> {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.ERROR_ASIENTO && nota.estado !== EstadoNotaCompra.ISSUED) {
      throw new BadRequestException('Solo se puede reintentar el asiento para notas registradas o con error de asiento');
    }

    try {
      if (typeof this.asientosContablesService.generarAsientoNotaAjusteCompra === 'function') {
        await this.asientosContablesService.generarAsientoNotaAjusteCompra(nota.id);
      }

      await this.notaRepository.update(id, {
        estado: EstadoNotaCompra.ISSUED,
        asientoError: null,
        fechaAsientoError: ''
      });

      this.logger.log(`Asiento contable reintentado para nota compra ${nota.numeroCompleto || id}`);
      return await this.findOne(id);

    } catch (error) {
      await this.notaRepository.update(id, {
        estado: EstadoNotaCompra.ERROR_ASIENTO,
        asientoError: error.message,
        fechaAsientoError: new Date()
      });

      this.logger.error(`Falló reintento de asiento para nota compra ${nota.numeroCompleto || id}: ${error.message}`);
      throw new BadRequestException(`Error generando asiento: ${error.message}`);
    }
  }
}
