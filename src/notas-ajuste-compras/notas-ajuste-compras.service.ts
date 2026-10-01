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
import { InventarioService, ResultadoKardex, AdvertenciaInventario } from 'src/inventario/inventario.service';
import { DocumentoInventario } from 'src/inventario/entities/movimiento-inventario.entity';

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
    private readonly dataSource: DataSource,
    private readonly inventarioService: InventarioService
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

      // BLOQUEO de inventario: la NC de compra devuelve mercancía al
      // proveedor (SALIDA). Sin stock no se registra (rollback total).
      // Solo CRÉDITO mueve inventario.
      if (!isDraft && tipo === TipoNotaCompra.CREDITO) {
        await this.inventarioService.validarDisponibilidad(
          queryRunner.manager,
          (itemsToSave ?? []).map((it) => ({
            articuloId: it.articuloId,
            cantidad: Number(it.cantidad),
          })),
          `NC compra ${notaGuardada.numeroCompleto || 'nueva'}`,
        );
      }

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

        // Cartera espejo de ventas (estricto: si falla, revierte la creación).
        // La nota nace registrada: su efecto debe mover la factura de inmediato.
        const cartera = this.aplicarACartera(factura, {
          tipo,
          total,
          esReembolsoAbono: dto.esReembolsoAbono,
        });
        factura.totalPagado = cartera.totalPagado;
        factura.saldoPendiente = cartera.saldoPendiente;
        factura.paymentStatus = cartera.paymentStatus;
        await queryRunner.manager.save(FacturaCompra, factura);
        await queryRunner.manager.update(NotaAjusteCompra,
          { id: notaGuardada.id },
          { saldoAplicado: true, valorAplicadoCartera: cartera.aplicado },
        );
        this.logger.log(`Cartera: ${tipo} ${notaGuardada.numeroCompleto} aplica $${cartera.aplicado} a factura ${factura.numero}`);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`✅ Nota ${tipo} ${notaGuardada.numeroCompleto || 'en borrador'} creada exitosamente`);

      // Kardex best-effort (post-commit): la NC de compra registrada devuelve
      // mercancía al proveedor (SALIDA). Solo CRÉDITO mueve inventario.
      let advertenciasInventario: Array<{ codigo: string; mensaje: string }> = [];
      if (!isDraft && tipo === TipoNotaCompra.CREDITO) {
        try {
          const kardex: ResultadoKardex = await this.inventarioService.registrarSalidasNCCompra(
            this.dataSource.manager,
            notaGuardada.id,
            (itemsToSave ?? []).map((it) => ({
              articuloId: it.articuloId,
              cantidad: Number(it.cantidad),
            })),
            notaGuardada.numeroCompleto || '',
            userId,
          );
          advertenciasInventario = this.alertasNegativo(kardex);
        } catch (invError) {
          this.logger.error(`Error kardex NC compra ${notaGuardada.numeroCompleto}: ${invError.message}`);
        }
      }

      const creada = await this.findOne(notaGuardada.id);
      if (advertenciasInventario.length) {
        (creada as any).advertenciasInventario = advertenciasInventario;
      }
      return creada;

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
      relations: ['proveedor', 'items', 'items.articulo', 'items.cuentaContable', 'items.impuesto', 'facturaOriginal', 'createdBy']
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

      // Actualizar la cartera espejo de ventas: el efecto vive en totalPagado
      // para que un pago posterior no lo borre (saldo = total − totalPagado).
      const cartera = this.aplicarACartera(factura, nota);
      factura.totalPagado = cartera.totalPagado;
      factura.saldoPendiente = cartera.saldoPendiente;
      factura.paymentStatus = cartera.paymentStatus;

      await queryRunner.manager.save(FacturaCompra, factura);

      const notaGuardada = await queryRunner.manager.save(NotaAjusteCompra, nota);
      await queryRunner.manager.update(NotaAjusteCompra,
        { id: notaGuardada.id },
        { saldoAplicado: true, valorAplicadoCartera: cartera.aplicado },
      );

      // BLOQUEO de inventario en la misma tx (solo CRÉDITO: devuelve mercancía).
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        await this.inventarioService.validarDisponibilidad(
          queryRunner.manager,
          (nota.items ?? []).map((it) => ({
            articuloId: it.articuloId,
            cantidad: Number(it.cantidad),
          })),
          `NC compra ${nota.numeroCompleto || ''}`,
        );
      }

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

      // Kardex best-effort: el borrador registrado devuelve mercancía (solo CRÉDITO).
      let advertenciasInventario: Array<{ codigo: string; mensaje: string }> = [];
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        try {
          const kardex: ResultadoKardex = await this.inventarioService.registrarSalidasNCCompra(
            this.dataSource.manager,
            notaGuardada.id,
            (nota.items ?? []).map((it) => ({
              articuloId: it.articuloId,
              cantidad: Number(it.cantidad),
            })),
            notaGuardada.numeroCompleto || '',
            userId,
          );
          advertenciasInventario = this.alertasNegativo(kardex);
        } catch (invError) {
          this.logger.error(`Error kardex registrar NC compra ${notaGuardada.numeroCompleto}: ${invError.message}`);
        }
      }

      const registrada = await this.findOne(notaGuardada.id);
      if (advertenciasInventario.length) {
        (registrada as any).advertenciasInventario = advertenciasInventario;
      }
      return registrada;

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

      // Reversa exacta de la aplicación (legacy: reversa directa del saldo).
      const cartera = this.revertirDeCartera(factura, nota);
      factura.totalPagado = cartera.totalPagado;
      factura.saldoPendiente = cartera.saldoPendiente;
      factura.paymentStatus = cartera.paymentStatus;

      await queryRunner.manager.save(FacturaCompra, factura);
      if (nota.saldoAplicado) {
        await queryRunner.manager.update(NotaAjusteCompra, { id: nota.id }, { saldoAplicado: false });
      }
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

      // Kardex best-effort: la NC de compra anula­da devuelve sus SALIDAs (solo CRÉDITO).
      let advertenciasInventario: Array<{ codigo: string; mensaje: string }> = [];
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        try {
          const kardex: ResultadoKardex = await this.inventarioService.revertirDocumento(
            this.dataSource.manager,
            DocumentoInventario.NOTA_CREDITO_COMPRA,
            id,
            `Anulación NC compra ${nota.numeroCompleto}`,
            nota.createdById,
          );
          advertenciasInventario = this.alertasNegativo(kardex);
        } catch (invError) {
          this.logger.error(`Error kardex anulación NC compra ${nota.numeroCompleto}: ${invError.message}`);
        }
      }

      const anulada = await this.findOne(id);
      if (advertenciasInventario.length) {
        (anulada as any).advertenciasInventario = advertenciasInventario;
      }
      return anulada;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** Política solo-alertar (helper central en InventarioService). */
  private alertasNegativo(kardex: ResultadoKardex): AdvertenciaInventario[] {
    return InventarioService.alertasNegativo(kardex);
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

  /**
   * Cartera espejo de ventas: el efecto de la nota vive en `totalPagado`
   * (NO como ajuste directo del saldo) para que un pago posterior no lo borre.
   * Invariante: saldoPendiente = total − totalPagado.
   *
   * - NC normal: se debe menos → totalPagado += min(total, saldo).
   * - NC con esReembolsoAbono: devuelven un abono en efectivo → totalPagado −= aplicado.
   * - ND: se debe más → totalPagado −= total.
   * Retorna el valor aplicado (0 si no aplicó).
   */
  private aplicarACartera(factura: FacturaCompra, nota: { tipo: TipoNotaCompra; total: number; esReembolsoAbono?: boolean | null }): {
    totalPagado: number;
    saldoPendiente: number;
    paymentStatus: PaymentStatus;
    aplicado: number;
  } {
    const total = Number(factura.total);
    const pagado = Number(factura.totalPagado);
    const saldo = Number(factura.saldoPendiente);
    const monto = Number(nota.total);

    let nuevoPagado = pagado;
    let aplicado = 0;

    if (nota.tipo === TipoNotaCompra.DEBITO) {
      aplicado = monto;
      nuevoPagado = MathUtil.sub(pagado, aplicado);
    } else if (nota.esReembolsoAbono) {
      aplicado = Math.min(monto, pagado);
      nuevoPagado = MathUtil.sub(pagado, aplicado);
    } else {
      aplicado = Math.min(monto, Math.max(0, saldo));
      nuevoPagado = MathUtil.sum(pagado, aplicado);
    }

    const nuevoSaldo = Math.max(0, MathUtil.sub(total, nuevoPagado));
    const paymentStatus = nuevoSaldo === 0
      ? PaymentStatus.PAID
      : nuevoPagado !== 0
        ? PaymentStatus.PARTIAL
        : PaymentStatus.PENDING;

    return { totalPagado: nuevoPagado, saldoPendiente: nuevoSaldo, paymentStatus, aplicado };
  }

  /**
   * Reversa exacta de aplicarACartera. Filas legacy (saldoAplicado falsy)
   * usan la reversa directa del saldo del comportamiento anterior.
   */
  private revertirDeCartera(factura: FacturaCompra, nota: NotaAjusteCompra): {
    totalPagado: number;
    saldoPendiente: number;
    paymentStatus: PaymentStatus;
  } {
    const total = Number(factura.total);

    if (!nota.saldoAplicado) {
      // Legacy: la nota movió el saldo directamente; se revierte igual.
      let saldo = Number(factura.saldoPendiente);
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        saldo = MathUtil.sum(saldo, Number(nota.total));
      } else {
        saldo = MathUtil.sub(saldo, Number(nota.total));
        if (saldo < 0) saldo = 0;
      }
      const pagado = Number(factura.totalPagado);
      let paymentStatus = factura.paymentStatus;
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        if (saldo > 0 && factura.paymentStatus === PaymentStatus.PAID) {
          paymentStatus = PaymentStatus.PARTIAL;
        }
      } else if (saldo <= 0) {
        paymentStatus = PaymentStatus.PAID;
      }
      return { totalPagado: pagado, saldoPendiente: saldo, paymentStatus };
    }

    const aplicado = Number(nota.valorAplicadoCartera ?? 0);
    const pagado = Number(factura.totalPagado);
    const nuevoPagado = (nota.tipo === TipoNotaCompra.DEBITO || nota.esReembolsoAbono)
      ? MathUtil.sum(pagado, aplicado)
      : Math.max(0, MathUtil.sub(pagado, aplicado));

    const nuevoSaldo = Math.max(0, MathUtil.sub(total, nuevoPagado));
    const paymentStatus = nuevoSaldo === 0
      ? PaymentStatus.PAID
      : nuevoPagado !== 0
        ? PaymentStatus.PARTIAL
        : PaymentStatus.PENDING;

    return { totalPagado: nuevoPagado, saldoPendiente: nuevoSaldo, paymentStatus };
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
        articuloId: itemDto.articuloId || null,
        cuentaContableId: itemDto.cuentaContableId || null,
        descripcion: itemDto.descripcion || '',
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
