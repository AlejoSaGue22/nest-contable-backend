import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { NotaAjusteSoporte } from './entities/nota-ajuste-soporte.entity';
import { ItemNotaAjusteSoporte } from './entities/item-nota-ajuste-soporte.entity';
import { DianStatusSoporte, DocumentoSoporte, TipoDocumentoSoporte } from 'src/documentos-soportes/entities/documento-soporte.entity';
import { DocumentoSoporteEstado } from 'src/documentos-soportes/entities/documento-soporte.entity';
import { CreateNotaAjusteSoporteDto } from './dto/create-nota-ajuste-soporte.dto';
import { UpdateNotaAjusteSoporteDto } from './dto/update-nota-ajuste-soporte.dto';
import { TipoNotaCompra, EstadoNotaCompra } from 'src/notas-ajuste-compras/enums/notas-ajuste-compra.enum';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { PaymentStatus } from 'src/pagos/enums/pago.enum';
import { MathUtil } from 'src/common/utils/math.util';
import { InventarioService, ResultadoKardex, AdvertenciaInventario } from 'src/inventario/inventario.service';
import { DocumentoInventario } from 'src/inventario/entities/movimiento-inventario.entity';
import { FactusService } from 'src/api-dian/services/factus.service';

@Injectable()
export class NotasAjusteSoporteService {
  private readonly logger = new Logger(NotasAjusteSoporteService.name);

  constructor(
    @InjectRepository(NotaAjusteSoporte)
    private readonly notaRepository: Repository<NotaAjusteSoporte>,
    @InjectRepository(ItemNotaAjusteSoporte)
    private readonly itemRepository: Repository<ItemNotaAjusteSoporte>,
    @InjectRepository(DocumentoSoporte)
    private readonly documentoRepository: Repository<DocumentoSoporte>,
    private readonly asientosContablesService: AsientosContablesService,
    private readonly dataSource: DataSource,
    private readonly inventarioService: InventarioService,
    private readonly factusService: FactusService,
  ) {}

  async crearNotaCredito(dto: CreateNotaAjusteSoporteDto, userId: string) {
    return this.crearNota(dto, userId, TipoNotaCompra.CREDITO);
  }

  async crearNotaDebito(dto: CreateNotaAjusteSoporteDto, userId: string) {
    return this.crearNota(dto, userId, TipoNotaCompra.DEBITO);
  }

  private async crearNota(dto: CreateNotaAjusteSoporteDto, userId: string, tipo: TipoNotaCompra) {
    this.logger.log(`📝 Creando Nota Soporte ${tipo} para documento ${dto.documentoOriginalId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const documento = await queryRunner.manager.findOne(DocumentoSoporte, {
        where: { id: dto.documentoOriginalId },
        relations: ['proveedor']
      });

      if (!documento) {
        throw new NotFoundException(`Documento soporte con ID ${dto.documentoOriginalId} no encontrado`);
      }

      if (documento.estado !== DocumentoSoporteEstado.REGISTRADO) {
        throw new BadRequestException('Solo se pueden crear notas para documentos registrados');
      }

      const esElectronica = documento.tipo === TipoDocumentoSoporte.ELECTRONICO;
      if (esElectronica && !dto.conceptoCorreccion) {
        throw new BadRequestException('La nota a un documento electrónico requiere el concepto de corrección DIAN');
      }

      let saldoDisponible = 0;
      if (tipo === TipoNotaCompra.CREDITO) {
        const totalNotasCredito = await this.calcularTotalNotasCredito(documento.id);
        saldoDisponible = Number(documento.total) - totalNotasCredito;
      }

      const { subtotal, iva, total, itemsCalculados } = await this.calcularTotales(dto.items);

      if (tipo === TipoNotaCompra.CREDITO && total > saldoDisponible) {
        throw new BadRequestException(`El total de la nota crédito ($${total}) excede el saldo disponible del documento ($${saldoDisponible})`);
      }

      const isDraft = dto.isDraft || false;
      const numeroNota = isDraft ? '' : await this.generateNotaNumber(tipo);
      const prefijo = tipo === TipoNotaCompra.CREDITO ? 'NCS' : 'NDS';

      const nota = queryRunner.manager.create(NotaAjusteSoporte, {
        tipo,
        prefijo: numeroNota ? prefijo : '',
        numero: numeroNota,
        numeroCompleto: numeroNota ? `${prefijo}-${numeroNota}` : '',
        documentoOriginalId: documento.id,
        documentoOriginalNumero: documento.numero || documento.numeroDian || '',
        proveedorId: documento.proveedorId,
        motivo: dto.motivo,
        conceptoCorreccion: dto.conceptoCorreccion || null,
        formaPago: dto.formaPago,
        metodoPago: dto.metodoPago || null,
        esReembolsoAbono: dto.esReembolsoAbono || false,
        fecha: dto.fecha,
        subtotal,
        iva,
        descuento: 0,
        total,
        saldoPendiente: total,
        estado: isDraft ? EstadoNotaCompra.DRAFT : EstadoNotaCompra.REGISTERED,
        observaciones: dto.observaciones,
        createdById: userId
      });

      const notaGuardada = await queryRunner.manager.save(NotaAjusteSoporte, nota);

      const itemsToSave = itemsCalculados.map(item =>
        queryRunner.manager.create(ItemNotaAjusteSoporte, {
          ...item,
          notaId: notaGuardada.id
        })
      );

      await queryRunner.manager.save(ItemNotaAjusteSoporte, itemsToSave);

      if (!isDraft && tipo === TipoNotaCompra.CREDITO) {
        await this.inventarioService.validarDisponibilidad(
          queryRunner.manager,
          (itemsToSave ?? []).map((it) => ({
            articuloId: it.articuloId,
            cantidad: Number(it.cantidad),
          })),
          `NC soporte ${notaGuardada.numeroCompleto || 'nueva'}`,
        );
      }

      if (!isDraft) {
        // Emisión DIAN antes del asiento: sin aceptación no hay efecto contable.
        if (esElectronica) {
          await this.emitirNota(queryRunner, notaGuardada, documento, dto, itemsToSave, userId);
          notaGuardada.numeroCompleto = notaGuardada.numeroCompleto || '';
        }

        try {
          notaGuardada.items = itemsToSave;
          notaGuardada.documentoOriginal = documento;
          await this.asientosContablesService.generarAsientoNotaAjusteCompra(notaGuardada, userId);
          this.logger.log(`Asiento contable generado automáticamente para ${tipo} ${notaGuardada.numeroCompleto}`);
        } catch (asientoError) {
          await queryRunner.manager.update(NotaAjusteSoporte,
            { id: notaGuardada.id },
            {
              estado: EstadoNotaCompra.ERROR_ASIENTO,
              asientoError: asientoError.message,
              fechaAsientoError: new Date()
            }
          );
          this.logger.error(`Error generando asiento contable para ${tipo}: ${asientoError.message}`);
        }

        const cartera = this.aplicarACartera(documento, {
          tipo,
          total,
          esReembolsoAbono: dto.esReembolsoAbono,
        });
        documento.totalPagado = cartera.totalPagado;
        documento.saldoPendiente = cartera.saldoPendiente;
        documento.paymentStatus = cartera.paymentStatus;
        await queryRunner.manager.save(DocumentoSoporte, documento);
        await queryRunner.manager.update(NotaAjusteSoporte,
          { id: notaGuardada.id },
          { saldoAplicado: true, valorAplicadoCartera: cartera.aplicado },
        );
        this.logger.log(`Cartera: ${tipo} ${notaGuardada.numeroCompleto} aplica $${cartera.aplicado} al documento ${documento.numero}`);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`✅ Nota Soporte ${tipo} ${notaGuardada.numeroCompleto || 'en borrador'} creada exitosamente`);

      let advertenciasInventario: Array<{ codigo: string; mensaje: string }> = [];
      if (!isDraft && tipo === TipoNotaCompra.CREDITO) {
        try {
          const kardex: ResultadoKardex = await this.inventarioService.registrarSalidasNCSoporte(
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
          this.logger.error(`Error kardex NC soporte ${notaGuardada.numeroCompleto}: ${invError.message}`);
        }
      }

      const creada = await this.findOne(notaGuardada.id);
      if (advertenciasInventario.length) {
        (creada as any).advertenciasInventario = advertenciasInventario;
      }
      return creada;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al crear nota de ajuste a soporte: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Error al crear la nota de ajuste a soporte');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Emite la nota a Factus/DIAN (solo DSE electrónico). Persiste referenceCode,
   * número oficial y snapshot en la nota. Rechazo → excepción (rollback del llamador).
   */
  private async emitirNota(
    queryRunner: any,
    nota: NotaAjusteSoporte,
    documento: DocumentoSoporte,
    dto: { conceptoCorreccion?: string; motivo: string; metodoPago?: string },
    items: ItemNotaAjusteSoporte[],
    _userId: string,
  ): Promise<void> {
    const referenceCode = nota.referenceCode || await this.generarReferenceCode();
    await queryRunner.manager.update(NotaAjusteSoporte, { id: nota.id }, {
      referenceCode,
      dianStatus: DianStatusSoporte.SENT,
      fechaEnvioDIAN: new Date(),
      intentosEnvio: (nota.intentosEnvio ?? 0) + 1,
    });

    const respuesta = await this.factusService.crearNotaAjusteDocumentoSoporte(
      referenceCode,
      documento,
      dto.conceptoCorreccion!,
      dto.motivo,
      dto.metodoPago || documento.metodoPago || '10',
      items.map((it) => ({
        articuloId: it.articuloId,
        cuentaContableId: it.cuentaContableId,
        articulo: (it as any).articulo,
        cuentaContable: (it as any).cuentaContable,
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad),
        valorUnitario: Number(it.valorUnitario),
        descuento: Number(it.descuento),
        porcentajeIva: Number(it.porcentajeIVA),
        subtotal: Number(it.subtotal),
        total: Number(it.total),
      })),
    );

    if (respuesta.estado !== 'aceptada') {
      throw new BadRequestException(`DIAN rechazó la nota de ajuste: ${respuesta.mensaje}`);
    }

    await queryRunner.manager.update(NotaAjusteSoporte, { id: nota.id }, {
      dianStatus: DianStatusSoporte.ACCEPTED,
      fechaAceptacionDIAN: new Date(),
      numeroCompleto: respuesta.numeroDian,
      cuds: respuesta.cuds || null,
      qrCode: respuesta.qrCode || null,
      publicUrl: respuesta.publicUrl || null,
      dianResponse: respuesta.respuestaCompleta,
      factusNumberingRangeId: respuesta.numberingRangeId ?? null,
      factusResolutionNumber: respuesta.resolutionNumber ?? null,
      factusRangePrefix: respuesta.rangePrefix ?? null,
    });
    nota.numeroCompleto = respuesta.numeroDian;
    nota.dianStatus = DianStatusSoporte.ACCEPTED;
  }

  private async generarReferenceCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `NAS-${year}-`;
    const ultima = await this.notaRepository.createQueryBuilder('nota')
      .where('nota.referenceCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('nota.referenceCode', 'DESC')
      .getOne();

    const ultimoNumero = ultima?.referenceCode ? parseInt(ultima.referenceCode.split('-')[2]) : 0;
    return `${prefix}${(ultimoNumero + 1).toString().padStart(6, '0')}`;
  }

  async findOne(id: string) {
    const nota = await this.notaRepository.findOne({
      where: { id },
      relations: ['proveedor', 'items', 'items.articulo', 'items.cuentaContable', 'items.impuesto', 'documentoOriginal', 'createdBy']
    });

    if (!nota) {
      throw new NotFoundException(`Nota de ajuste a soporte con ID ${id} no encontrada`);
    }

    return nota;
  }

  async findAll(filtros: any) {
    const { page = 1, limit = 10 } = filtros;
    const skip = (page - 1) * limit;

    const query = this.notaRepository.createQueryBuilder('nota')
      .leftJoinAndSelect('nota.proveedor', 'proveedor')
      .leftJoinAndSelect('nota.documentoOriginal', 'documentoOriginal')
      .leftJoinAndSelect('nota.createdBy', 'createdBy');

    if (filtros.tipo) {
      query.andWhere('nota.tipo = :tipo', { tipo: filtros.tipo });
    }
    if (filtros.estado) {
      query.andWhere('nota.estado = :estado', { estado: filtros.estado });
    }
    if (filtros.documentoNumero) {
      query.andWhere('nota.documentoOriginalNumero ILIKE :documentoNumero', { documentoNumero: `%${filtros.documentoNumero}%` });
    }
    if (filtros.proveedorNombre) {
      query.andWhere('(proveedor.razonSocial ILIKE :proveedorNombre OR proveedor.nombre ILIKE :proveedorNombre)', { proveedorNombre: `%${filtros.proveedorNombre}%` });
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

    const documento = await this.documentoRepository.findOne({
      where: { id: nota.documentoOriginalId }
    });

    if (!documento) {
      throw new NotFoundException('Documento original no encontrado');
    }

    if (nota.tipo === TipoNotaCompra.CREDITO) {
      const totalNotasCredito = await this.calcularTotalNotasCredito(nota.documentoOriginalId);
      const saldoDisponible = Number(documento.total) - totalNotasCredito;

      if (Number(nota.total) > saldoDisponible) {
        throw new BadRequestException(`Esta nota crédito ($${Number(nota.total)}) excede el saldo disponible del documento ($${saldoDisponible}).`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const numero = await this.generateNotaNumber(nota.tipo);
      const prefijo = nota.tipo === TipoNotaCompra.CREDITO ? 'NCS' : 'NDS';

      nota.numero = numero;
      nota.numeroCompleto = `${prefijo}-${numero}`;
      nota.prefijo = prefijo;
      nota.estado = EstadoNotaCompra.REGISTERED;

      const esElectronica = documento.tipo === TipoDocumentoSoporte.ELECTRONICO;

      if (esElectronica) {
        if (!nota.conceptoCorreccion) {
          throw new BadRequestException('La nota a un documento electrónico requiere el concepto de corrección DIAN');
        }
        const items = await queryRunner.manager.find(ItemNotaAjusteSoporte, {
          where: { notaId: nota.id },
          relations: ['articulo', 'cuentaContable'],
        });
        await this.emitirNota(queryRunner, nota, documento, {
          conceptoCorreccion: nota.conceptoCorreccion,
          motivo: nota.motivo,
          metodoPago: nota.metodoPago || undefined,
        }, items, userId);
      }

      const cartera = this.aplicarACartera(documento, nota);
      documento.totalPagado = cartera.totalPagado;
      documento.saldoPendiente = cartera.saldoPendiente;
      documento.paymentStatus = cartera.paymentStatus;

      await queryRunner.manager.save(DocumentoSoporte, documento);

      const notaGuardada = await queryRunner.manager.save(NotaAjusteSoporte, nota);
      await queryRunner.manager.update(NotaAjusteSoporte,
        { id: notaGuardada.id },
        { saldoAplicado: true, valorAplicadoCartera: cartera.aplicado },
      );

      if (nota.tipo === TipoNotaCompra.CREDITO) {
        await this.inventarioService.validarDisponibilidad(
          queryRunner.manager,
          (nota.items ?? []).map((it) => ({
            articuloId: it.articuloId,
            cantidad: Number(it.cantidad),
          })),
          `NC soporte ${nota.numeroCompleto || ''}`,
        );
      }

      await queryRunner.commitTransaction();

      try {
        await this.asientosContablesService.generarAsientoNotaAjusteCompra(notaGuardada, userId);
      } catch (error) {
        this.logger.error(`Error generando asiento contable para nota soporte ${nota.id}: ${error.message}`);
        await this.notaRepository.update(notaGuardada.id, {
          estado: EstadoNotaCompra.ERROR_ASIENTO,
          asientoError: error.message,
          fechaAsientoError: new Date()
        });
      }

      let advertenciasInventario: Array<{ codigo: string; mensaje: string }> = [];
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        try {
          const kardex: ResultadoKardex = await this.inventarioService.registrarSalidasNCSoporte(
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
          this.logger.error(`Error kardex registrar NC soporte ${notaGuardada.numeroCompleto}: ${invError.message}`);
        }
      }

      const registrada = await this.findOne(notaGuardada.id);
      if (advertenciasInventario.length) {
        (registrada as any).advertenciasInventario = advertenciasInventario;
      }
      return registrada;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al registrar nota de ajuste a soporte: ${error.message}`, error.stack);
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

    if (nota.estaValidada()) {
      throw new BadRequestException('No se puede anular una nota de ajuste validada por la DIAN');
    }

    const documento = await this.documentoRepository.findOne({
      where: { id: nota.documentoOriginalId }
    });

    if (!documento) {
      throw new NotFoundException('Documento original no encontrado');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      nota.estado = EstadoNotaCompra.CANCELLED;
      nota.observaciones = `${nota.observaciones ? nota.observaciones + '\n' : ''}Anulada: ${motivo}`;

      const cartera = this.revertirDeCartera(documento, nota);
      documento.totalPagado = cartera.totalPagado;
      documento.saldoPendiente = cartera.saldoPendiente;
      documento.paymentStatus = cartera.paymentStatus;

      await queryRunner.manager.save(DocumentoSoporte, documento);
      if (nota.saldoAplicado) {
        await queryRunner.manager.update(NotaAjusteSoporte, { id: nota.id }, { saldoAplicado: false });
      }
      await queryRunner.manager.save(NotaAjusteSoporte, nota);

      await queryRunner.commitTransaction();

      try {
        await this.asientosContablesService.generarAsientoAnulacionNotaAjusteSoporte(nota.id);
      } catch (e) {
        this.logger.error('Error anulando asiento', e);
      }

      let advertenciasInventario: Array<{ codigo: string; mensaje: string }> = [];
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        try {
          const kardex: ResultadoKardex = await this.inventarioService.revertirDocumento(
            this.dataSource.manager,
            DocumentoInventario.NOTA_CREDITO_SOPORTE,
            id,
            `Anulación NC soporte ${nota.numeroCompleto}`,
            nota.createdById,
          );
          advertenciasInventario = this.alertasNegativo(kardex);
        } catch (invError) {
          this.logger.error(`Error kardex anulación NC soporte ${nota.numeroCompleto}: ${invError.message}`);
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

  private alertasNegativo(kardex: ResultadoKardex): AdvertenciaInventario[] {
    return InventarioService.alertasNegativo(kardex);
  }

  async update(id: string, updateDto: UpdateNotaAjusteSoporteDto): Promise<NotaAjusteSoporte> {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.DRAFT) {
      throw new BadRequestException('Solo se pueden modificar notas en estado borrador');
    }

    const nuevoTotal = Number(updateDto.total ?? nota.total);
    if (nota.tipo === TipoNotaCompra.CREDITO && nuevoTotal !== Number(nota.total)) {
      const documento = await this.documentoRepository.findOne({ where: { id: nota.documentoOriginalId } });
      if (!documento) throw new NotFoundException('Documento original no encontrado');
      const totalNotasCredito = await this.calcularTotalNotasCredito(nota.documentoOriginalId);
      const totalNotasExcluyendoEsta = totalNotasCredito - Number(nota.total);
      const saldoDisponible = Number(documento.total) - totalNotasExcluyendoEsta;
      if (nuevoTotal > saldoDisponible) {
        throw new BadRequestException(`El nuevo total ($${nuevoTotal}) excede el saldo disponible del documento ($${saldoDisponible})`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let subtotal = Number(nota.subtotal);
      let iva = Number(nota.iva);
      let total = Number(nota.total);

      if (updateDto.items && updateDto.items.length > 0) {
        const calc = await this.calcularTotales(updateDto.items);
        subtotal = calc.subtotal;
        iva = calc.iva;
        total = calc.total;

        await queryRunner.manager.delete(ItemNotaAjusteSoporte, { notaId: id });

        const newItems = calc.itemsCalculados.map(item =>
          queryRunner.manager.create(ItemNotaAjusteSoporte, {
            ...item,
            notaId: id
          })
        );
        await queryRunner.manager.save(ItemNotaAjusteSoporte, newItems);
      }

      const updatePayload: any = {
        subtotal: Math.round(subtotal),
        iva: Math.round(iva),
        total: Math.round(total),
        saldoPendiente: Math.round(total)
      };

      if (updateDto.motivo) updatePayload.motivo = updateDto.motivo;
      if (updateDto.conceptoCorreccion) updatePayload.conceptoCorreccion = updateDto.conceptoCorreccion;
      if (updateDto.metodoPago) updatePayload.metodoPago = updateDto.metodoPago;
      if (updateDto.fecha) updatePayload.fecha = updateDto.fecha;
      if (updateDto.observaciones) updatePayload.observaciones = updateDto.observaciones;
      if (updateDto.esReembolsoAbono !== undefined) updatePayload.esReembolsoAbono = updateDto.esReembolsoAbono;
      if (updateDto.formaPago) updatePayload.formaPago = updateDto.formaPago;

      await queryRunner.manager.update(NotaAjusteSoporte, { id }, updatePayload);
      await queryRunner.commitTransaction();

      return await this.findOne(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error actualizando nota soporte ${id}: ${error.message}`, error.stack);
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
    this.logger.log(`Nota de ajuste a soporte eliminada: ${nota.numeroCompleto || id}`);
  }

  private aplicarACartera(documento: DocumentoSoporte, nota: { tipo: TipoNotaCompra; total: number; esReembolsoAbono?: boolean | null }): {
    totalPagado: number;
    saldoPendiente: number;
    paymentStatus: PaymentStatus;
    aplicado: number;
  } {
    const total = Number(documento.total);
    const pagado = Number(documento.totalPagado);
    const saldo = Number(documento.saldoPendiente);
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

  private revertirDeCartera(documento: DocumentoSoporte, nota: NotaAjusteSoporte): {
    totalPagado: number;
    saldoPendiente: number;
    paymentStatus: PaymentStatus;
  } {
    const total = Number(documento.total);

    if (!nota.saldoAplicado) {
      let saldo = Number(documento.saldoPendiente);
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        saldo = MathUtil.sum(saldo, Number(nota.total));
      } else {
        saldo = MathUtil.sub(saldo, Number(nota.total));
        if (saldo < 0) saldo = 0;
      }
      const pagado = Number(documento.totalPagado);
      let paymentStatus = documento.paymentStatus;
      if (nota.tipo === TipoNotaCompra.CREDITO) {
        if (saldo > 0 && documento.paymentStatus === PaymentStatus.PAID) {
          paymentStatus = PaymentStatus.PARTIAL;
        }
      } else if (saldo <= 0) {
        paymentStatus = PaymentStatus.PAID;
      }
      return { totalPagado: pagado, saldoPendiente: saldo, paymentStatus };
    }

    const aplicado = Number(nota.valorAplicadoCartera ?? 0);
    const pagado = Number(documento.totalPagado);
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

  private async calcularTotalNotasCredito(documentoId: string): Promise<number> {
    const notasCredito = await this.notaRepository.find({
      where: {
        documentoOriginalId: documentoId,
        tipo: TipoNotaCompra.CREDITO,
        estado: In([EstadoNotaCompra.REGISTERED, EstadoNotaCompra.ERROR_ASIENTO])
      }
    });
    return notasCredito.reduce((sum, nota) => sum + Number(nota.total), 0);
  }

  async reintentarAsiento(id: string, userId: string): Promise<NotaAjusteSoporte> {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNotaCompra.ERROR_ASIENTO && nota.estado !== EstadoNotaCompra.REGISTERED) {
      throw new BadRequestException('Solo se puede reintentar el asiento para notas registradas o con error de asiento');
    }

    try {
      await this.asientosContablesService.generarAsientoNotaAjusteCompra(nota, userId);

      await this.notaRepository.update(id, {
        estado: EstadoNotaCompra.REGISTERED,
        asientoError: null,
        fechaAsientoError: ''
      });

      this.logger.log(`Asiento contable reintentado para nota soporte ${nota.numeroCompleto || id}`);
      return await this.findOne(id);

    } catch (error) {
      await this.notaRepository.update(id, {
        estado: EstadoNotaCompra.ERROR_ASIENTO,
        asientoError: error.message,
        fechaAsientoError: new Date()
      });

      this.logger.error(`Falló reintento de asiento para nota soporte ${nota.numeroCompleto || id}: ${error.message}`);
      throw new BadRequestException(`Error generando asiento: ${error.message}`);
    }
  }

  async descargarPdf(id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const nota = await this.findOne(id);
    const numeroDian = nota.numeroCompleto && nota.estaValidada() ? nota.numeroCompleto : null;
    if (!numeroDian) {
      throw new BadRequestException('Solo las notas validadas ante DIAN tienen PDF en Factus');
    }
    return this.factusService.descargarPDFNotaAjusteSoporte(numeroDian);
  }

  private async calcularTotales(items: any[]): Promise<{
    subtotal: number;
    iva: number;
    total: number;
    itemsCalculados: Partial<ItemNotaAjusteSoporte>[];
  }> {
    let subtotal = 0;
    let iva = 0;
    let total = 0;
    const itemsCalculados: Partial<ItemNotaAjusteSoporte>[] = [];

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
