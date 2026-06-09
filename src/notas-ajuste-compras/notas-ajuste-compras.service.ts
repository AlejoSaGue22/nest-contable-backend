import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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
import { MathUtil } from 'src/common/utils/math.util';

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
    this.logger.log(`📝 Creando Nota ${tipo} para factura ${dto.facturaOriginalId}`);
 
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = await queryRunner.manager.findOne(FacturaCompra, {
        where: { id: dto.facturaOriginalId },
        relations: ['proveedor']
      });

      if (!factura) {
        throw new NotFoundException(`Factura de compra con ID ${dto.facturaOriginalId} no encontrada`);
      }

      if (factura.estado !== GastoEstado.REGISTRADO) {
          throw new BadRequestException('Solo se pueden crear notas para facturas registradas');
      }

      // Validar que el total de la NC crédito no exceda el saldo de la factura
      let saldoDisponible = 0;
      if (tipo === TipoNotaCompra.CREDITO) {
        const totalNotasCredito = await this.calcularTotalNotasCredito(factura.id);
        saldoDisponible = Number(factura.total) - totalNotasCredito;
      }
      
      const { subtotal, iva, total, itemsCalculados } = await this.calcularTotales(dto.items);

      if (tipo === TipoNotaCompra.CREDITO && total > saldoDisponible) {
        throw new BadRequestException(`El total de la nota crédito ($${total}) excede el saldo disponible de la factura ($${saldoDisponible})`);
      }

      // 3. Generar número de nota solo si NO es borrador
      const isDraft = dto.isDraft || false;
      const numeroNota = isDraft ? '' : await this.generateNotaNumber(tipo);

      // 4. Crear nota
      const nota = queryRunner.manager.create(NotaAjusteCompra, {
        tipo,
        prefijo: numeroNota ? tipo === TipoNotaCompra.CREDITO ? 'NCC' : 'NDC' : '',
        numero: numeroNota,
        numeroCompleto: numeroNota ? `${tipo === TipoNotaCompra.CREDITO ? 'NCC' : 'NDC'}-${numeroNota}` : '',
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.numero || '',
        proveedorId: factura.proveedorId,
        motivo: dto.motivo,
        formaPago: dto.formaPago,
        metodoPago: dto.metodoPago || null,
        esReembolsoAbono: dto.esReembolsoAbono || false,
        fecha: dto.fecha,
        subtotal,
        iva,
        descuento: dto.descuento || 0,
        total,
        saldoPendiente: total,
        estado: isDraft ? EstadoNotaCompra.DRAFT : EstadoNotaCompra.REGISTERED,
        observaciones: dto.observaciones,
        createdById: userId
      });

      const notaGuardada = await queryRunner.manager.save(NotaAjusteCompra, nota);

      const itemsToSave = itemsCalculados.map(item => 
        queryRunner.manager.create(ItemNotaAjusteCompra, {
          ...item,
          notaId: notaGuardada.id
        })
      );

      await queryRunner.manager.save(ItemNotaAjusteCompra, itemsToSave);

      if (!isDraft) {
        try {
          notaGuardada.items = itemsToSave;
          notaGuardada.facturaOriginal = factura;
          await this.asientosContablesService.generarAsientoNotaAjusteCompra(notaGuardada, userId);
          this.logger.log(`Asiento contable generado automáticamente para ${tipo} ${notaGuardada.numeroCompleto}`);
        } catch (asientoError) {
          await queryRunner.manager.update(NotaAjusteCompra,
            { id: notaGuardada.id },
            {
              estado: EstadoNotaCompra.ERROR_ASIENTO,
              asientoError: asientoError.message,
              fechaAsientoError: new Date()
            }
          );
          this.logger.error(`Error generando asiento contable para ${tipo}: ${asientoError.message}`);
        }
      }

      await queryRunner.commitTransaction();
 
      this.logger.log(`✅ Nota ${tipo} ${notaGuardada.numeroCompleto || 'en borrador'} creada exitosamente`);
 
      return await this.findOne(notaGuardada.id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al crear nota de ajuste compra: ${error.message}`, error.stack);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
 
      throw new InternalServerErrorException('Error al crear la nota de ajuste de compra');
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
      const numero = await this.generateNotaNumber(nota.tipo);
      const prefijo = nota.tipo === TipoNotaCompra.CREDITO ? 'NCC' : 'NDC';
      
      nota.numero = numero; 
      nota.numeroCompleto = `${prefijo}-${numero}`;
      nota.prefijo = prefijo;
      nota.estado = EstadoNotaCompra.REGISTERED;

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
           await this.asientosContablesService.generarAsientoNotaAjusteCompra(notaGuardada, userId);
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

    if (nota.estado !== EstadoNotaCompra.REGISTERED) {
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
          const calc = await this.calcularTotales(updateDto.items);
          subtotal = calc.subtotal;
          iva = calc.iva;
          total = calc.total;

          // 1. Eliminar items actuales
          await queryRunner.manager.delete(ItemNotaAjusteCompra, { notaId: id });

          // 2. Crear nuevos items
          const newItems = calc.itemsCalculados.map(item =>
            queryRunner.manager.create(ItemNotaAjusteCompra, {
              ...item,
              notaId: id
            })
          );
          await queryRunner.manager.save(ItemNotaAjusteCompra, newItems);
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
      if (updateDto.fecha) updatePayload.fecha = updateDto.fecha;
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
        estado: In([EstadoNotaCompra.REGISTERED, EstadoNotaCompra.ERROR_ASIENTO])
      }
    });
    return notasCredito.reduce((sum, nota) => sum + Number(nota.total), 0);
  }

  async reintentarAsiento(id: string, userId: string): Promise<NotaAjusteCompra> {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.ERROR_ASIENTO && nota.estado !== EstadoNotaCompra.REGISTERED) {
      throw new BadRequestException('Solo se puede reintentar el asiento para notas registradas o con error de asiento');
    }

    try {
      if (typeof this.asientosContablesService.generarAsientoNotaAjusteCompra === 'function') {
        await this.asientosContablesService.generarAsientoNotaAjusteCompra(nota, userId);
      }

      await this.notaRepository.update(id, {
        estado: EstadoNotaCompra.REGISTERED,
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

  private async calcularTotales(items: any[]): Promise<{
    subtotal: number;
    iva: number;
    total: number;
    itemsCalculados: Partial<ItemNotaAjusteCompra>[];
  }> {
    let subtotal = 0;
    let iva = 0;
    let total = 0;
    const itemsCalculados: Partial<ItemNotaAjusteCompra>[] = [];
 
    for (const itemDto of items) {
      const cantidad = Number(itemDto.cantidad);
      const valorUnitario = Number(itemDto.valorUnitario);
      const porcentajeIVA = Number(itemDto.porcentajeIVA || 0);
      const descuento = Number(itemDto.descuento || 0);
      
      const itemSubtotalSinDescuento = MathUtil.mul(valorUnitario, cantidad);
      const valorDescuento = MathUtil.percentage(itemSubtotalSinDescuento, descuento);
      const itemSubtotal = MathUtil.sub(itemSubtotalSinDescuento, valorDescuento);
      const itemIVA = MathUtil.percentage(itemSubtotal, porcentajeIVA);
      const itemTotal = MathUtil.sum(itemSubtotal, itemIVA);
 
      itemsCalculados.push({
        articuloId: itemDto.articuloId,
        impuestoId: itemDto.impuestoId || null,
        valorUnitario,
        porcentajeIVA,
        cantidad,
        subtotal: itemSubtotal,
        valorIVA: itemIVA,
        descuento: descuento,
        valorDescuento: valorDescuento,
        total: itemTotal,
      });
 
      subtotal = MathUtil.sum(subtotal, itemSubtotal);
      iva = MathUtil.sum(iva, itemIVA);
      total = MathUtil.sum(total, itemTotal);
    }
 
    return { subtotal, iva, total, itemsCalculados };
  }

  private async generateNotaNumber(tipo: TipoNotaCompra): Promise<string> {
      const lastNota = await this.notaRepository.findOne({
        where: { tipo },
        order: { createdAt: 'DESC' }
      });
  
      const lastNumber = lastNota?.numero ? parseInt(lastNota.numero) : 0;
      return (lastNumber + 1).toString().padStart(8, '0');
  }
}
