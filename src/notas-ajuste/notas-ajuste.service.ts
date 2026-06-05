import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateNotaCreditoDto, CreateNotaDebitoDto, CreateNotasAjusteDto } from './dto/create-notas-ajuste.dto';
import { UpdateNotasAjusteDto } from './dto/update-notas-ajuste.dto';
import { NotaAjuste } from './entities/notas-ajuste.entity';
import { EstadoDIANNota, EstadoNota, TipoNota } from './enums/notas-ajuste.enum';
import { ItemNotaAjuste } from './entities/items-notas-ajuste.entity';
import { NotasAjusteFilterDto } from './dto/nota-ajuste-filter.dto';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { InvoiceStatus, TipoFactura } from 'src/facturas-ventas/enums/factura-venta.enum';
import { DataSource, In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FactusService } from 'src/api-dian/services/factus.service';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { MathUtil } from 'src/common/utils/math.util';

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
  ) {}
 
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
        relations: ['client']
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
      
      const { subtotal, iva, total, itemsCalculados } = 
        await this.calcularTotales(queryRunner, createDto.items);

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

      const itemsToSave = itemsCalculados.map(item => 
        queryRunner.manager.create(ItemNotaAjuste, {
          ...item,
          notaId: notaGuardada.id
        })
      );

      await queryRunner.manager.save(ItemNotaAjuste, itemsToSave);

      if(factura.tipoFactura == TipoFactura.STANDARD && isDraft == false){
        try {
          notaGuardada.items = itemsToSave;
          await this.asientosService.generarAsientoNotaAjuste(notaGuardada, notaGuardada.createdById);
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
   * Crear Nota Débito
   */
  async crearNotaDebito(
    createDto: CreateNotaDebitoDto,
    userId: string
  ): Promise<NotaAjuste> {
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
        prefijo: 'ND',
        numero: numeroNota,
        numeroCompleto: numeroNota ? `ND-${numeroNota}` : '',
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.comprobante_completo,
        clienteId: factura.clientId,
        concepto: createDto.concepto,
        motivo: createDto.motivo,
        fecha: createDto.fecha || '',
        // fechaVencimiento: createDto.fechaVencimiento || '',
        items: itemsCalculados,
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

    // Validación específica para Nota Crédito: no exceder saldo de la factura original
    if (nota.esNotaCredito()) {
      const totalNotasCredito = await this.calcularTotalNotasCredito(nota.facturaOriginalId);
      const nuevoTotalConEstaNota = MathUtil.sum(totalNotasCredito, Number(nota.total));
      
      if (nuevoTotalConEstaNota > Number(factura.total)) {
        throw new BadRequestException(`Esta Nota Crédito excede el saldo disponible de la factura original.`);
      }
    }
  
    this.logger.log(`📤 Emitiendo ${nota.tipo} ${nota.numeroCompleto} a DIAN`);
    const numeroNota = await this.generateNotaNumber(nota.tipo);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
  
    try {
      // 1. Cambiar estado a SENT dentro de la transacción
      await queryRunner.manager.update(NotaAjuste, { id }, {
        estado: EstadoNota.SENT,
        estadoDIAN: EstadoDIANNota.ENVIADA,
        fechaEnvioDIAN: new Date(),
        intentosEnvio: nota.intentosEnvio + 1
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
          nota.items
        );
      } else {
        respuesta = await this.factusService.crearNotaDebito(
          numeroNota,
          nota.facturaOriginal,
          nota.motivo,
          nota.metodoPago || '',
          nota.concepto,
          nota.items
        );
      }
  
      // 3. Procesar respuesta
      if (respuesta.estado === 'aceptada') {
        const updateAceptada: Partial<NotaAjuste> = {
          estado: EstadoNota.ACCEPTED,
          estadoDIAN: EstadoDIANNota.ACEPTADA,
          fechaAceptacionDIAN: new Date(),
          cufe: respuesta.cufe,
          cude: respuesta.cude,
          xmlUrl: respuesta.xmlUrl,
          pdfUrl: respuesta.pdfUrl,
          qrCode: respuesta.qrImageBase64,
          proveedorResponse: respuesta.respuestaCompleta,
          prefijo: nota.tipo === TipoNota.CREDITO ? 'NC' : 'ND',
          numero: numeroNota,
        };
  
        if (respuesta.numeroCompleto) {
          updateAceptada.numeroCompleto = respuesta.numeroCompleto;
        }

        // Generar asiento contable
        try {
          await this.asientosService.generarAsientoNotaAjuste(nota, userId);
          this.logger.log(`Asiento contable generado automáticamente para ${nota.tipo} ${nota.numeroCompleto}`);
        } catch (asientoError) {
          updateAceptada.estado = EstadoNota.ERROR_ASIENTO;
          updateAceptada.asientoError = asientoError.message;
          updateAceptada.fechaAsientoError = new Date(); 
          this.logger.error(`Error generando asiento contable para ${nota.tipo}: ${asientoError.message}`);
        }

        await queryRunner.manager.update(NotaAjuste, { id }, updateAceptada);
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
      await this.asientosService.generarAsientoNotaAjuste(nota, nota.createdById);
      
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
          const data = nota.tipo === TipoNota.CREDITO ? respuesta.data.credit_note : respuesta.data.debit_note;

          nota.estado = EstadoNota.ACCEPTED;
          nota.estadoDIAN = EstadoDIANNota.ACEPTADA;
          nota.cufe = data.cufe;
          nota.cude = data.cude;
          nota.xmlUrl = data.qr;
          nota.pdfUrl = data.qr;
          nota.fechaAceptacionDIAN = data.created_at ? new Date(data.created_at) : new Date();
          
          // Intentar generar asiento si no existe
          try {
            await this.asientosService.generarAsientoNotaAjuste(nota, userId);
          } catch (error) {
            nota.estado = EstadoNota.ERROR_ASIENTO;
            nota.asientoError = error.message;
            nota.fechaAsientoError = new Date();
          }

          await this.notaRepository.save(nota);
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
      throw new BadRequestException(
        'Solo se pueden anular notas aceptadas por DIAN'
      );
    }
 
    nota.estado = EstadoNota.CANCELLED;
    nota.estadoDIAN = EstadoDIANNota.ANULADA;
    nota.observaciones = `Anulada: ${motivo}`;
 
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
 
    return await this.factusService.descargarPDFNota(nota.numeroCompleto);
  }
 
  /**
   * Descargar XML de nota
   */
  async descargarXML(id: string): Promise<{ buffer: Buffer, fileName: string }> {
    const nota = await this.findOne(id);
 
    if (!nota.cufe || !nota.numeroCompleto) {
      throw new BadRequestException('Esta nota no tiene CUFE o número de documento');
    }
 
    return await this.factusService.descargarXMLNota(nota.numeroCompleto);
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
  async calcularImpactoEnFactura(facturaId: string): Promise<{totalNotasCredito: number; totalNotasDebito: number; saldoNeto: number;}> {
    const notas = await this.obtenerNotasPorFactura(facturaId);
    const notasCredito = notas.filter(n => n.tipo === TipoNota.CREDITO && n.estado === EstadoNota.ACCEPTED);
    const notasDebito = notas.filter(n => n.tipo === TipoNota.DEBITO && n.estado === EstadoNota.ACCEPTED);
    const totalNotasCredito = notasCredito.reduce((sum, n) => MathUtil.sum(sum, Number(n.total)), 0);
    const totalNotasDebito = notasDebito.reduce((sum, n) => MathUtil.sum(sum, Number(n.total)), 0);
    const saldoNeto = MathUtil.sub(totalNotasDebito, totalNotasCredito);
 
    return { totalNotasCredito, totalNotasDebito, saldoNeto };
  }
 
  // ========== MÉTODOS PRIVADOS ==========
 
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
