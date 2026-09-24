import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateNotaCreditoDto, CreateNotaDebitoDto, CreateNotasAjusteDto } from './dto/create-notas-ajuste.dto';
import { UpdateNotasAjusteDto } from './dto/update-notas-ajuste.dto';
import { NotaAjuste } from './entities/notas-ajuste.entity';
import { ConceptoNotaCredito, EstadoDIANNota, EstadoNota, TipoNota } from './enums/notas-ajuste.enum';
import { ItemNotaAjuste } from './entities/items-notas-ajuste.entity';
import { NotasAjusteFilterDto } from './dto/nota-ajuste-filter.dto';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { InvoiceStatus, TipoFactura } from 'src/facturas-ventas/enums/factura-venta.enum';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FactusService } from 'src/api-dian/services/factus.service';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { ContabilizacionEngine } from 'src/asientos-contables/engine/contabilizacion.engine';
import { MathUtil } from 'src/common/utils/math.util';
import { DisponibilidadNotaService } from './disponibilidad/disponibilidad-nota.service';
import { PaymentDetailsResolver } from './factus/payment-details.resolver';
import { CreateNotaCreditoV2Dto } from './dto/create-nota-credito-v2.dto';
import { UpdateNotaCreditoV2Dto } from './dto/update-nota-credito-v2.dto';
import { CreditNoteCalculator } from './credito/credit-note-calculator.service';
import { CarteraNotaService } from './cartera/cartera-nota.service';
import { InventarioService } from 'src/inventario/inventario.service';
import { DocumentoInventario } from 'src/inventario/entities/movimiento-inventario.entity';

@Injectable()
export class NotasAjusteService {
  private readonly logger = new Logger(NotasAjusteService.name);

  constructor(
    @InjectRepository(NotaAjuste)
    private readonly notaRepository: Repository<NotaAjuste>,

    @InjectRepository(ItemNotaAjuste)
    private readonly itemRepository: Repository<ItemNotaAjuste>,

    @InjectRepository(FacturasVenta)
    private readonly facturaRepository: Repository<FacturasVenta>,

    private readonly dataSource: DataSource,
    private readonly factusService: FactusService,
    private readonly asientosService: AsientosContablesService,
    private readonly contabilizacionEngine: ContabilizacionEngine,
    private readonly disponibilidadService: DisponibilidadNotaService,
    private readonly paymentResolver: PaymentDetailsResolver,
    private readonly creditCalculator: CreditNoteCalculator,
    private readonly carteraService: CarteraNotaService,
    private readonly inventarioService: InventarioService,
  ) { }

  /**
   * Crear Nota Crédito
   */
  async crearNotaCredito(createDto: CreateNotaCreditoDto, userId: string): Promise<NotaAjuste> {
    this.logger.log(`📝 Creando Nota Crédito para factura ${createDto.facturaOriginalId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id: createDto.facturaOriginalId },
        relations: ['client', 'items']
      });

      if (!factura) {
        throw new NotFoundException('Factura original no encontrada');
      }

      if (factura.esElectronica() && factura.status !== InvoiceStatus.ACCEPTED) {
        throw new BadRequestException('Solo se pueden crear notas para facturas electrónicas aceptadas por DIAN');
      }

      if (!factura.esElectronica() && factura.status !== InvoiceStatus.ISSUED) {
        throw new BadRequestException('Solo se pueden crear notas para facturas estándar emitidas');
      }

      // 2. Validar que el total de las NC no exceda el saldo de la factura (para electrónicas y estándar)
      let saldoDisponible = 0;
      const totalNotasCredito = await this.calcularTotalNotasCredito(factura.id);
      saldoDisponible = Number(factura.total) - totalNotasCredito;

      const { subtotal, iva, total, itemsCalculados } = await this.calcularTotales(queryRunner, createDto.items);

      if (total > saldoDisponible) {
        throw new BadRequestException(`El total de la nota crédito ($${total}) excede el saldo disponible de la factura ($${saldoDisponible})`);
      }

      // 3. Generar número de nota solo si NO es borrador
      const isDraft = factura.esElectronica() ? true : createDto.isDraft ? true : false;
      const numeroNota = isDraft ? '' : await this.generateNotaNumber(TipoNota.CREDITO);

      // 4. Crear nota crédito
      const notaCredito = queryRunner.manager.create(NotaAjuste, {
        tipo: TipoNota.CREDITO,
        prefijo: numeroNota ? 'NC' : '',
        numero: numeroNota,
        numeroCompleto: numeroNota ? `NC-${numeroNota}` : '',
        formaPago: createDto.formaPago,
        metodoPago: createDto.metodoPago || null,
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.comprobante_completo,
        clienteId: factura.clientId,
        concepto: createDto.concepto,
        motivo: createDto.motivo,
        fecha: createDto.fecha,
        // fechaVencimiento: createDto.fechaVencimiento,
        //items: itemsCalculados,
        subtotal,
        iva,
        descuento: createDto.descuento,
        total,
        saldoPendiente: total,
        estado: isDraft ? EstadoNota.DRAFT : EstadoNota.ISSUED,
        estadoDIAN: factura.esElectronica() ? EstadoDIANNota.PENDIENTE : EstadoDIANNota.NO_APLICA,
        observaciones: createDto.observaciones,
        createdById: userId
      });

      const notaGuardada = await queryRunner.manager.save(NotaAjuste, notaCredito);

      // Capas 1-2: snapshot de la factura fuente + input del usuario por línea.
      // El resultado (capa 3) ya viene en itemsCalculados; impuestos (capa 4)
      // en detalleCalculo. Capas pobladas aunque el cálculo por concepto
      // llegue en la fase de estrategias (hoy cálculo genérico legacy).
      const facturaItemsPorArticulo = new Map<string, any>();
      for (const fi of factura.items ?? []) {
        if (!facturaItemsPorArticulo.has(fi.articuloId)) {
          facturaItemsPorArticulo.set(fi.articuloId, fi);
        }
      }
      const mueveInventario =
        createDto.concepto === ConceptoNotaCredito.DEVOLUCION_PARCIAL ||
        createDto.concepto === ConceptoNotaCredito.ANULACION;

      const itemsToSave = itemsCalculados.map((item, idx) => {
        const dtoItem: any = createDto.items[idx];
        const fuente = facturaItemsPorArticulo.get(item.articuloId ?? '');
        return queryRunner.manager.create(ItemNotaAjuste, {
          ...item,
          notaId: notaGuardada.id,
          cantidadOriginal: fuente ? Number(fuente.quantity) : null,
          precioOriginal: fuente ? Number(fuente.unitPrice) : null,
          subtotalOriginal: fuente ? Number(fuente.subtotal) : null,
          valorDescuentoOriginal: fuente ? Number(fuente.valor_discount ?? 0) : null,
          valorIVAOriginal: fuente ? Number(fuente.valor_iva ?? 0) : null,
          totalOriginal: fuente ? Number(fuente.total) : null,
          cantidadInput: dtoItem ? Number(dtoItem.cantidad) : null,
          precioNuevo: createDto.concepto === ConceptoNotaCredito.AJUSTE_PRECIO && dtoItem
            ? Number(dtoItem.valorUnitario)
            : null,
          descuentoTasaInput: dtoItem?.descuento ?? null,
          descuentoValorInput: null,
          afectaInventario: mueveInventario,
        });
      });

      await queryRunner.manager.save(ItemNotaAjuste, itemsToSave);

      if (factura.tipoFactura == TipoFactura.STANDARD && isDraft == false) {
        try {
          notaGuardada.items = itemsToSave;
          notaGuardada.facturaOriginal = factura;
          await this.contabilizacionEngine.contabilizarDocumento('NOTA_AJUSTE', notaGuardada.id, notaGuardada.createdById, queryRunner);
          this.logger.log(`Asiento contable generado automáticamente para notas credito ${notaGuardada.numeroCompleto}`);

        } catch (error) {
          await queryRunner.manager.update(NotaAjuste,
            { id: notaGuardada.id },
            {
              estado: EstadoNota.ERROR_ASIENTO,
              asientoError: error.message,
              fechaAsientoError: new Date()
            }
          );
          this.logger.error(`Error generando asiento contable NC: ${error.message}`);
        }

        // Cartera: la NC estándar emitida acredita de inmediato.
        // Estricto aquí (nada externo aún): si falla, revierte la creación.
        await this.carteraService.aplicar(queryRunner.manager, notaGuardada);

        // Kardex: devolución/anulación devuelven stock (estricto, misma tx).
        notaGuardada.items = itemsToSave;
        await this.entradasInventarioNC(queryRunner.manager, notaGuardada);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`✅ Nota Crédito ${notaGuardada.numeroCompleto} creada en borrador`);

      return notaGuardada;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creando nota crédito: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Error al crear la nota crédito');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crear Nota Crédito V2 (guía NC 2026).
   * El concepto DIAN controla el cálculo: el DTO trae solo el input del
   * concepto y el CreditNoteCalculator recalcula todo (fuente de verdad).
   * Sin formaPago en el contrato: se espeja la factura internamente.
   */
  async crearNotaCreditoV2(createDto: CreateNotaCreditoV2Dto, userId: string): Promise<NotaAjuste> {
    this.logger.log(`📝 Creando Nota Crédito V2 (concepto ${createDto.concepto}) para factura ${createDto.facturaOriginalId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id: createDto.facturaOriginalId },
        relations: ['client']
      });

      if (!factura) {
        throw new NotFoundException('Factura original no encontrada');
      }

      const { lines, subtotal, iva, total } = await this.creditCalculator.calculate(createDto);

      // Electrónica siempre borrador → emitir. Estándar según isDraft.
      const isDraft = factura.esElectronica() ? true : createDto.isDraft ? true : false;
      const numeroNota = isDraft ? '' : await this.generateNotaNumber(TipoNota.CREDITO);

      const notaCredito = queryRunner.manager.create(NotaAjuste, {
        tipo: TipoNota.CREDITO,
        prefijo: numeroNota ? 'NC' : '',
        numero: numeroNota,
        numeroCompleto: numeroNota ? `NC-${numeroNota}` : '',
        // Interno: espejo de la factura (el usuario no lo elige).
        formaPago: factura.formaPago,
        metodoPago: factura.metodoPago || null,
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.comprobante_completo,
        clienteId: factura.clientId,
        concepto: createDto.concepto,
        motivo: createDto.motivo,
        fecha: createDto.fecha,
        subtotal,
        iva,
        descuento: createDto.descuentoTasaGlobal ?? 0,
        total,
        saldoPendiente: total,
        esReembolsoAbono: createDto.esReembolsoAbono ?? false,
        estado: isDraft ? EstadoNota.DRAFT : EstadoNota.ISSUED,
        estadoDIAN: factura.esElectronica() ? EstadoDIANNota.PENDIENTE : EstadoDIANNota.NO_APLICA,
        observaciones: createDto.observaciones,
        createdById: userId
      });

      const notaGuardada = await queryRunner.manager.save(NotaAjuste, notaCredito);

      const itemsToSave = lines.map(item =>
        queryRunner.manager.create(ItemNotaAjuste, {
          ...item,
          notaId: notaGuardada.id
        })
      );

      await queryRunner.manager.save(ItemNotaAjuste, itemsToSave);

      if (factura.tipoFactura == TipoFactura.STANDARD && isDraft == false) {
        try {
          notaGuardada.items = itemsToSave;
          notaGuardada.facturaOriginal = factura;
          await this.contabilizacionEngine.contabilizarDocumento('NOTA_AJUSTE', notaGuardada.id, notaGuardada.createdById, queryRunner);
          this.logger.log(`Asiento contable generado automáticamente para NC V2 ${notaGuardada.numeroCompleto}`);

        } catch (error) {
          await queryRunner.manager.update(NotaAjuste,
            { id: notaGuardada.id },
            {
              estado: EstadoNota.ERROR_ASIENTO,
              asientoError: error.message,
              fechaAsientoError: new Date()
            }
          );
          this.logger.error(`Error generando asiento contable NC V2: ${error.message}`);
        }

        // Cartera: la NC V2 estándar emitida acredita de inmediato (estricto).
        await this.carteraService.aplicar(queryRunner.manager, notaGuardada);

        // Kardex: devolución/anulación devuelven stock (estricto, misma tx).
        notaGuardada.items = itemsToSave;
        await this.entradasInventarioNC(queryRunner.manager, notaGuardada);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`✅ Nota Crédito V2 ${notaGuardada.numeroCompleto} creada (concepto ${createDto.concepto})`);

      return notaGuardada;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creando nota crédito V2: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Error al crear la nota crédito');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Editar borrador NC (V2): recalcula todo por concepto desde la factura.
   * Solo DRAFT + CREDITO. La factura fuente no cambia (el concepto sí puede).
   */
  async updateNotaCreditoV2(id: string, updateDto: UpdateNotaCreditoV2Dto): Promise<NotaAjuste> {
    const nota = await this.findOne(id);

    if (!nota.esNotaCredito()) {
      throw new BadRequestException('Esta ruta solo edita Notas Crédito');
    }
    if (!nota.puedeEnviarse()) {
      throw new BadRequestException('Solo se pueden modificar notas en estado borrador');
    }

    const { lines, subtotal, iva, total } = await this.creditCalculator.calculate({
      ...updateDto,
      facturaOriginalId: nota.facturaOriginalId,
    } as any);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(NotaAjuste, { id }, {
        concepto: updateDto.concepto,
        motivo: updateDto.motivo,
        fecha: updateDto.fecha as any,
        observaciones: updateDto.observaciones,
        esReembolsoAbono: updateDto.esReembolsoAbono ?? false,
        subtotal,
        iva,
        descuento: updateDto.descuentoTasaGlobal ?? 0,
        total,
        saldoPendiente: total,
      });

      await queryRunner.manager.delete(ItemNotaAjuste, { notaId: id });

      const itemsToSave = lines.map((item) =>
        queryRunner.manager.create(ItemNotaAjuste, { ...item, notaId: id }),
      );
      await queryRunner.manager.save(ItemNotaAjuste, itemsToSave);

      await queryRunner.commitTransaction();
      this.logger.log(`Nota V2 ${nota.numeroCompleto || id} actualizada (concepto ${updateDto.concepto})`);
      return await this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error actualizando nota V2 ${id}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar la nota crédito');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crear Nota Débito
   */
  async crearNotaDebito(createDto: CreateNotaDebitoDto, userId: string): Promise<NotaAjuste> {
    this.logger.log(`📝 Creando Nota Débito para factura ${createDto.facturaOriginalId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar factura original
      const factura = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id: createDto.facturaOriginalId },
        relations: ['client']
      });

      if (!factura) {
        throw new NotFoundException('Factura original no encontrada');
      }

      // Validar según tipo de factura
      if (factura.esElectronica()) {
        // Para facturas electrónicas: debe estar aceptada por DIAN
        if (factura.status !== InvoiceStatus.ACCEPTED) {
          throw new BadRequestException('Solo se pueden crear notas para facturas electrónicas aceptadas por DIAN');
        }
      } else {
        // Para facturas estándar: debe estar emitida
        if (factura.status !== InvoiceStatus.ISSUED) {
          throw new BadRequestException('Solo se pueden crear notas para facturas estándar emitidas');
        }
      }

      // 2. Calcular totales
      const { subtotal, iva, total, itemsCalculados } =
        await this.calcularTotales(queryRunner, createDto.items);

      // 3. Generar número de nota solo si NO es borrador
      const isDraft = createDto.isDraft ?? false;
      const numeroNota = isDraft ? '' : await this.generateNotaNumber(TipoNota.DEBITO);

      // 4. Crear nota débito
      const notaDebito = queryRunner.manager.create(NotaAjuste, {
        tipo: TipoNota.DEBITO,
        prefijo: numeroNota ? 'ND' : '',
        numero: numeroNota,
        numeroCompleto: numeroNota ? `ND-${numeroNota}` : '',
        formaPago: createDto.formaPago,
        metodoPago: createDto.metodoPago || null,
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.comprobante_completo,
        clienteId: factura.clientId,
        concepto: createDto.concepto,
        motivo: createDto.motivo,
        fecha: createDto.fecha || '',
        // fechaVencimiento: createDto.fechaVencimiento || '',
        subtotal,
        iva,
        descuento: 0,
        total,
        saldoPendiente: total,
        estado: isDraft ? EstadoNota.DRAFT : EstadoNota.ISSUED,
        estadoDIAN: factura.esElectronica() ? EstadoDIANNota.PENDIENTE : EstadoDIANNota.NO_APLICA,
        observaciones: createDto.observaciones,
        createdById: userId
      });

      const notaGuardada = await queryRunner.manager.save(NotaAjuste, notaDebito);

      // Guardar items explícitamente (la relación no tiene cascade)
      const itemsToSaveND = itemsCalculados.map(item =>
        queryRunner.manager.create(ItemNotaAjuste, {
          ...item,
          notaId: notaGuardada.id
        })
      );

      await queryRunner.manager.save(ItemNotaAjuste, itemsToSaveND);

      // Paridad con NC: contabilizar al crear estándar no borrador
      // (numeroCompleto ya existe, la referencia del asiento queda correcta).
      if (factura.tipoFactura == TipoFactura.STANDARD && isDraft == false) {
        try {
          notaGuardada.items = itemsToSaveND;
          notaGuardada.facturaOriginal = factura;
          await this.contabilizacionEngine.contabilizarDocumento('NOTA_AJUSTE', notaGuardada.id, notaGuardada.createdById, queryRunner);
          this.logger.log(`Asiento contable generado automáticamente para nota débito ${notaGuardada.numeroCompleto}`);

        } catch (error) {
          await queryRunner.manager.update(NotaAjuste,
            { id: notaGuardada.id },
            {
              estado: EstadoNota.ERROR_ASIENTO,
              asientoError: error.message,
              fechaAsientoError: new Date()
            }
          );
          this.logger.error(`Error generando asiento contable ND: ${error.message}`);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`✅ Nota Débito ${notaGuardada.numeroCompleto} creada en borrador`);

      return notaGuardada;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creando nota débito: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Error al crear la nota débito');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Emitir nota de ajuste (enviar a DIAN vía Factus)
   */
  async emitir(id: string, userId: string): Promise<NotaAjuste> {
    const nota = await this.findOne(id);

    if (!nota.puedeEnviarse()) {
      throw new BadRequestException(`No se puede emitir una nota en estado ${nota.obtenerEstadoLegible()}`);
    }

    const factura = await this.facturaRepository.findOne({ where: { id: nota.facturaOriginalId } });
    if (!factura) throw new NotFoundException('Factura original no encontrada');

    if (nota.esNotaCredito()) {
      const totalNotasCredito = await this.calcularTotalNotasCredito(nota.facturaOriginalId);
      const nuevoTotalConEstaNota = MathUtil.sum(totalNotasCredito, Number(nota.total));

      if (nuevoTotalConEstaNota > Number(factura.total)) {
        throw new BadRequestException(`Esta Nota Crédito excede el saldo disponible de la factura original.`);
      }
    }

    this.logger.log(`📤 Emitiendo ${nota.tipo} ${nota.numeroCompleto} a DIAN`);
    const numeroNota = await this.generateNotaNumber(nota.tipo);
    const tipoFactus = nota.esNotaCredito() ? 'credito' : 'debito';

    // reference_code estable: se persiste ANTES de enviar (idempotencia).
    const referenceCode = this.factusService.buildNotaReferenceCode(
      tipoFactus,
      numeroNota,
      factura.comprobante_completo,
    );

    // payment_details resuelto internamente (no UI, no modelo contable).
    const paymentResolution = this.paymentResolver.resolve(factura, Number(nota.total));
    for (const w of paymentResolution.warnings) {
      this.logger.warn(`payment_details [${paymentResolution.strategy}]: ${w}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Cambiar estado a SENT dentro de la transacción
      await queryRunner.manager.update(NotaAjuste, { id }, {
        estado: EstadoNota.SENT,
        estadoDIAN: EstadoDIANNota.ENVIADA,
        fechaEnvioDIAN: new Date(),
        intentosEnvio: nota.intentosEnvio + 1,
        factusReferenceCode: referenceCode,
      });

      // 2. Enviar a Factus/DIAN
      let respuesta: any;
      if (nota.esNotaCredito()) {
        respuesta = await this.factusService.crearNotaCredito(
          numeroNota,
          nota.facturaOriginal,
          nota.motivo,
          nota.metodoPago || '',
          nota.concepto,
          nota.items,
          paymentResolution.details,
        );
      } else {
        respuesta = await this.factusService.crearNotaDebito(
          numeroNota,
          nota.facturaOriginal,
          nota.motivo,
          nota.metodoPago || '',
          nota.concepto,
          nota.items,
          paymentResolution.details,
        );
      }

      // 3. Procesar respuesta
      if (respuesta.estado === 'aceptada') {
        // Fuente de verdad: el numeroCompleto de Factus. Fallback al local.
        const prefijoFinal = nota.tipo === TipoNota.CREDITO ? 'NC' : 'ND';
        const numeroCompletoFinal = respuesta.numeroCompleto || `${prefijoFinal}-${numeroNota}`;

        // 3a. Persistir el número DEFINITIVO antes de contabilizar, para que
        // la estrategia lea numeroCompleto y el asiento quede con referencia correcta
        // (nunca 'Borrador').
        await queryRunner.manager.update(NotaAjuste, { id }, {
          estado: EstadoNota.ACCEPTED,
          estadoDIAN: EstadoDIANNota.ACEPTADA,
          fechaAceptacionDIAN: new Date(),
          cufe: respuesta.cufe,
          cude: respuesta.cude,
          xmlUrl: respuesta.xmlUrl,
          pdfUrl: respuesta.pdfUrl,
          qrCode: respuesta.qrImageBase64 || respuesta.qrCode,
          proveedorResponse: respuesta.respuestaCompleta,
          prefijo: prefijoFinal,
          numero: numeroNota,
          numeroCompleto: numeroCompletoFinal,
          factusReferenceCode: respuesta.referenceCode || referenceCode,
          factusNumberingRangeId: respuesta.numberingRangeId ?? null,
          factusResolutionNumber: respuesta.resolutionNumber ?? null,
          factusRangePrefix: respuesta.rangePrefix ?? null,
        });

        // 3b. Generar asiento contable (lee el número ya persistido)
        try {
          await this.contabilizacionEngine.contabilizarDocumento('NOTA_AJUSTE', nota.id, userId, queryRunner);
          this.logger.log(`Asiento contable generado automáticamente para ${nota.tipo} ${numeroCompletoFinal}`);
        } catch (asientoError) {
          await queryRunner.manager.update(NotaAjuste, { id }, {
            estado: EstadoNota.ERROR_ASIENTO,
            asientoError: asientoError.message,
            fechaAsientoError: new Date(),
          });
          this.logger.error(`Error generando asiento contable para ${nota.tipo}: ${asientoError.message}`);
        }

        // 3c. Cartera best-effort (Factus ya aceptó: nunca revertir lo externo).
        await this.carteraService
          .aplicar(queryRunner.manager, { ...nota, numeroCompleto: numeroCompletoFinal } as NotaAjuste)
          .catch((carteraError) =>
            this.logger.error(`Error aplicando cartera a ${numeroCompletoFinal}: ${carteraError.message}`),
          );

        // 3d. Kardex best-effort: devolución/anulación devuelven stock.
        await this.entradasInventarioNC(
          queryRunner.manager,
          { ...nota, numeroCompleto: numeroCompletoFinal } as NotaAjuste,
        ).catch((invError) =>
          this.logger.error(`Error kardex NC ${numeroCompletoFinal}: ${invError.message}`),
        );

        this.logger.log(`✅ ${nota.tipo} ACEPTADA por DIAN: CUFE: ${respuesta.cufe} - CUDE: ${respuesta.cude}`);

      } else {
        await queryRunner.manager.update(NotaAjuste, { id }, {
          estado: EstadoNota.REJECTED,
          estadoDIAN: EstadoDIANNota.RECHAZADA,
          mensajeError: respuesta.mensaje,
          dianResponse: respuesta.respuestaCompleta
        });

        this.logger.error(`❌ ${nota.tipo} RECHAZADA: ${respuesta.mensaje}`);
      }

      await queryRunner.commitTransaction();
      return await this.findOne(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error emitiendo nota ${id}: ${error.message}`);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(`Error al emitir la nota de ajuste: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Reintentar la generación del asiento contable para una nota ya aceptada
   */
  async reintentarAsiento(id: string): Promise<NotaAjuste> {
    const nota = await this.findOne(id);

    if (nota.estado !== EstadoNota.ERROR_ASIENTO && nota.estado !== EstadoNota.ACCEPTED) {
      throw new BadRequestException('Solo se puede reintentar el asiento para notas aceptadas o con error de asiento');
    }

    try {
      await this.contabilizacionEngine.contabilizarDocumento('NOTA_AJUSTE', nota.id, nota.createdById);

      await this.notaRepository.update(id, {
        estado: EstadoNota.ACCEPTED,
        asientoError: null,
        fechaAsientoError: ''
      });

      this.logger.log(`✅ Asiento contable reintentado y generado para nota ${nota.numeroCompleto}`);
      return await this.findOne(id);

    } catch (error) {
      await this.notaRepository.update(id, {
        estado: EstadoNota.ERROR_ASIENTO,
        asientoError: error.message,
        fechaAsientoError: new Date()
      });

      this.logger.error(`❌ Falló reintento de asiento para nota ${nota.numeroCompleto}: ${error.message}`);
      throw new BadRequestException(`Error generando asiento: ${error.message}`);
    }
  }

  /**
   * Sincronizar el estado de la nota con la DIAN/Factus
   */
  async sincronizarConDIAN(id: string, userId: string): Promise<NotaAjuste> {
    let nota = await this.findOne(id);

    if (!nota.numeroCompleto && !nota.cufe) {
      // Si no tiene número ni CUFE, intentamos ver si podemos encontrarla en Factus 
      // Pero por ahora, requerimos al menos el número si se guardó
      throw new BadRequestException('No se puede sincronizar una nota que no tiene número asignado');
    }

    this.logger.log(`🔄 Sincronizando nota ${nota.numeroCompleto} con DIAN...`);

    try {
      const respuesta = await this.factusService.verNotaByNumero(
        nota.numeroCompleto,
        nota.tipo === TipoNota.CREDITO ? 'credito' : 'debito'
      );

      if (respuesta.status === 'OK') {
        const data = nota.tipo === TipoNota.CREDITO
          ? (respuesta.data.credit_note || respuesta.data)
          : (respuesta.data.debit_note || respuesta.data);

        nota.estado = EstadoNota.ACCEPTED;
        nota.estadoDIAN = EstadoDIANNota.ACEPTADA;
        nota.cufe = data.cufe;
        nota.cude = data.cude;
        nota.xmlUrl = data.links?.public_url || data.qr;
        nota.pdfUrl = data.links?.public_url || data.qr;
        nota.fechaAceptacionDIAN = data.created_at ? new Date(data.created_at) : new Date();

        // Intentar generar asiento si no existe
        try {
          await this.contabilizacionEngine.contabilizarDocumento('NOTA_AJUSTE', nota.id, userId);
        } catch (error) {
          nota.estado = EstadoNota.ERROR_ASIENTO;
          nota.asientoError = error.message;
          nota.fechaAsientoError = new Date();
        }

        await this.notaRepository.save(nota);

        // Cartera best-effort (después del save para no pisar el flag).
        await this.carteraService
          .aplicar(this.dataSource.manager, nota)
          .catch((carteraError) =>
            this.logger.error(`Error aplicando cartera a ${nota.numeroCompleto}: ${carteraError.message}`),
          );

        // Kardex best-effort.
        await this.entradasInventarioNC(this.dataSource.manager, nota)
          .catch((invError) =>
            this.logger.error(`Error kardex NC ${nota.numeroCompleto}: ${invError.message}`),
          );

        this.logger.log(`✅ Nota ${nota.numeroCompleto} sincronizada y actualizada`);
      } else {
        this.logger.warn(`La nota ${nota.numeroCompleto} aún no está aceptada en DIAN (Estado: ${respuesta.status})`);
      }

      return await this.findOne(id);

    } catch (error) {
      this.logger.error(`Error sincronizando nota ${id}: ${error.message}`);
      throw new BadRequestException(`Error al sincronizar con Factus: ${error.message}`);
    }
  }

  /**
   * Listar notas de ajuste
   */
  async findAll(filtros: NotasAjusteFilterDto): Promise<{
    data: NotaAjuste[];
    meta: any;
  }> {
    try {
      const { page = 1, limit = 10, ...where } = filtros;
      const skip = (page - 1) * limit;

      const queryBuilder = this.notaRepository
        .createQueryBuilder('nota')
        .leftJoinAndSelect('nota.cliente', 'cliente')
        .leftJoinAndSelect('nota.facturaOriginal', 'factura')
        .leftJoinAndSelect('nota.items', 'items')
        .leftJoinAndSelect('nota.createdBy', 'createdBy')
        .where('1=1');

      // Aplicar filtros
      if (where.tipo) {
        queryBuilder.andWhere('nota.tipo = :tipo', { tipo: where.tipo });
      }

      if (where.estado) {
        queryBuilder.andWhere('nota.estado = :estado', { estado: where.estado });
      }

      if (where.estadoDIAN) {
        queryBuilder.andWhere('nota.estadoDIAN = :estadoDIAN', { estadoDIAN: where.estadoDIAN });
      }

      if (where.facturaNumero) {
        queryBuilder.andWhere('nota.facturaOriginalNumero LIKE :facturaNumero', {
          facturaNumero: `%${where.facturaNumero}%`
        });
      }

      if (where.clienteNombre) {
        queryBuilder.andWhere('cliente.nombre LIKE :clienteNombre', {
          clienteNombre: `%${where.clienteNombre}%`
        });
      }

      if (where.fechaInicio && where.fechaFin) {
        queryBuilder.andWhere('nota.fecha BETWEEN :fechaInicio AND :fechaFin', {
          fechaInicio: where.fechaInicio,
          fechaFin: where.fechaFin
        });
      }

      // Ordenar y paginar
      queryBuilder
        .orderBy('nota.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      this.logger.error(`Error obteniendo notas: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al obtener las notas de ajuste');
    }
  }

  /**
   * Obtener nota por ID
   */
  async findOne(id: string): Promise<NotaAjuste> {
    try {
      const nota = await this.notaRepository.findOne({
        where: { id },
        relations: ['cliente', 'facturaOriginal', 'items', 'items.articulo', 'items.impuesto', 'metodoPagoRelacion', 'createdBy']
      });

      if (!nota) {
        throw new NotFoundException(`Nota de ajuste con ID ${id} no encontrada`);
      }

      return nota;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error obteniendo nota ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al obtener la nota de ajuste');
    }
  }

  /**
   * Actualizar nota (solo borrador)
   */
  async update(id: string, updateDto: UpdateNotasAjusteDto): Promise<NotaAjuste> {
    const nota = await this.findOne(id);

    if (!nota.puedeEnviarse()) {
      throw new BadRequestException('Solo se pueden modificar notas en estado borrador');
    }

    // Guard: el PATCH legacy recalcula con formato legacy. Los borradores V2
    // (capas por concepto) se recrean, no se editan, hasta tener update V2.
    const body: any = updateDto;
    // OJO: `concepto` solo NO marca V2 (el DTO legacy también lo trae).
    const esPayloadV2 =
      body?.aplicarDescuentoATodo !== undefined ||
      (Array.isArray(body?.items) &&
        body.items.some(
          (it: any) =>
            it?.precioNuevo !== undefined ||
            it?.descuentoTasa !== undefined ||
            it?.descuentoValor !== undefined,
        ));
    if (esPayloadV2) {
      throw new BadRequestException(
        'La edición de borradores V2 aún no está soportada: elimine el borrador y cree la nota de nuevo',
      );
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
        const calc = await this.calcularTotales(queryRunner, updateDto.items);
        subtotal = calc.subtotal;
        iva = calc.iva;
        total = calc.total;

        // 1. Eliminar items actuales
        await queryRunner.manager.delete(ItemNotaAjuste, { notaId: id });

        // 2. Crear nuevos items
        const newItems = calc.itemsCalculados.map(item =>
          queryRunner.manager.create(ItemNotaAjuste, {
            ...item,
            notaId: id
          })
        );
        await queryRunner.manager.save(ItemNotaAjuste, newItems);
      }

      // 3. Preparar payload de actualización para la nota
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

      // 4. Actualizar nota directo
      await queryRunner.manager.update(NotaAjuste, { id }, updatePayload);

      await queryRunner.commitTransaction();

      this.logger.log(`Nota ${nota.numeroCompleto} actualizada exitosamente`);

      return await this.findOne(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error actualizando nota ${id}: ${error.message}`, error.stack);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al actualizar la nota de ajuste');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Anular nota
   */
  async anular(id: string, motivo: string): Promise<NotaAjuste> {
    const nota = await this.findOne(id);

    if (!nota.estaAceptada()) {
      throw new BadRequestException('Solo se pueden anular notas aceptadas por DIAN');
    }

    // Cartera primero (estricto): si la reversa falla, la nota sigue aceptada.
    await this.carteraService.revertir(this.dataSource.manager, nota);

    // Kardex: reversar las entradas de la NC (estricto).
    await this.inventarioService.revertirDocumento(
      this.dataSource.manager,
      DocumentoInventario.NOTA_CREDITO,
      nota.id,
      `Anulación NC ${nota.numeroCompleto}`,
      nota.createdById,
    );

    nota.estado = EstadoNota.CANCELLED;
    nota.estadoDIAN = EstadoDIANNota.ANULADA;
    nota.observaciones = `Anulada: ${motivo}`;
    // Evitar que el save pise el flag ya revertido en BD.
    nota.saldoAplicado = false;

    // TODO: Generar asiento reversa
    // await this.asientosService.generarAsientoReversaNotaAjuste(nota);

    await this.notaRepository.save(nota);

    this.logger.log(`Nota anulada: ${nota.numeroCompleto}`);
    return nota;
  }

  /**
   * Remover nota
   */
  async remove(id: string): Promise<void> {
    const nota = await this.findOne(id);

    if (!nota.puedeEliminarse()) {
      throw new BadRequestException(
        'Solo se pueden eliminar notas en estado borrador'
      );
    }

    await this.notaRepository.softDelete({ id });
    this.logger.log(`Nota eliminada: ${nota.numeroCompleto}`);

  }


  /**
   * Descargar PDF de nota
   */
  async descargarPDF(id: string): Promise<{ buffer: Buffer, fileName: string }> {
    const nota = await this.findOne(id);

    if (!nota.cufe || !nota.numeroCompleto) {
      throw new BadRequestException('Esta nota no tiene CUFE o número de documento');
    }

    return await this.factusService.descargarPDFNota(nota.numeroCompleto, nota.esNotaCredito() ? 'credito' : 'debito');
  }

  /**
   * Descargar XML de nota
   */
  async descargarXML(id: string): Promise<{ buffer: Buffer, fileName: string }> {
    const nota = await this.findOne(id);

    if (!nota.cufe || !nota.numeroCompleto) {
      throw new BadRequestException('Esta nota no tiene CUFE o número de documento');
    }

    return await this.factusService.descargarXMLNota(
      nota.numeroCompleto,
      nota.esNotaCredito() ? 'credito' : 'debito',
    );
  }

  /**
   * Obtener notas de una factura específica
   */
  async obtenerNotasPorFactura(facturaId: string): Promise<NotaAjuste[]> {
    return await this.notaRepository.find({
      where: { facturaOriginalId: facturaId },
      relations: ['items'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Calcular impacto total de notas en una factura
   */
  async calcularImpactoEnFactura(facturaId: string): Promise<{ totalNotasCredito: number; totalNotasDebito: number; saldoNeto: number; }> {
    const notas = await this.obtenerNotasPorFactura(facturaId);
    const notasCredito = notas.filter(n => n.tipo === TipoNota.CREDITO && n.estado === EstadoNota.ACCEPTED);
    const notasDebito = notas.filter(n => n.tipo === TipoNota.DEBITO && n.estado === EstadoNota.ACCEPTED);
    const totalNotasCredito = notasCredito.reduce((sum, n) => MathUtil.sum(sum, Number(n.total)), 0);
    const totalNotasDebito = notasDebito.reduce((sum, n) => MathUtil.sum(sum, Number(n.total)), 0);
    const saldoNeto = MathUtil.sub(totalNotasDebito, totalNotasCredito);

    return { totalNotasCredito, totalNotasDebito, saldoNeto };
  }

  // ========== MÉTODOS PRIVADOS ==========

  /** ENTRADAs de kardex por NC (solo líneas con afectaInventario). */
  private async entradasInventarioNC(manager: any, nota: NotaAjuste): Promise<number> {
    return this.inventarioService.registrarEntradasNC(
      manager,
      nota.id,
      (nota.items ?? []).map((it) => ({
        articuloId: it.articuloId,
        cantidad: Number(it.cantidad),
        afectaInventario: it.afectaInventario,
      })),
      nota.numeroCompleto || '',
      nota.createdById,
    );
  }

  private async calcularTotales(queryRunner: any, items: any[]): Promise<{
    subtotal: number;
    iva: number;
    total: number;
    itemsCalculados: Partial<ItemNotaAjuste>[];
  }> {
    let subtotal = 0;
    let iva = 0;
    let total = 0;
    const itemsCalculados: Partial<ItemNotaAjuste>[] = [];

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
        detalleCalculo: { base: itemSubtotal, tasaIva: porcentajeIVA, iva: itemIVA },
      });

      subtotal = MathUtil.sum(subtotal, itemSubtotal);
      iva = MathUtil.sum(iva, itemIVA);
      total = MathUtil.sum(total, itemTotal);
    }

    return { subtotal, iva, total, itemsCalculados };
  }

  private async calcularTotalNotasCredito(facturaId: string): Promise<number> {
    const notasCredito = await this.notaRepository.find({
      where: {
        facturaOriginalId: facturaId,
        tipo: TipoNota.CREDITO,
        estado: In([EstadoNota.ACCEPTED, EstadoNota.ISSUED])
      }
    });

    const total = notasCredito.reduce((sum, nota) => MathUtil.sum(sum, Number(nota.total)), 0);

    return total;
  }

  private async generateNotaNumber(tipo: TipoNota): Promise<string> {
    const lastNota = await this.notaRepository.findOne({
      where: { tipo },
      order: { createdAt: 'DESC' }
    });

    const lastNumber = lastNota?.numero ? parseInt(lastNota.numero) : 0;
    return (lastNumber + 1).toString().padStart(8, '0');
  }
}
