import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateNotaCreditoDto, CreateNotaDebitoDto, CreateNotasAjusteDto } from './dto/create-notas-ajuste.dto';
import { UpdateNotasAjusteDto } from './dto/update-notas-ajuste.dto';
import { NotaAjuste } from './entities/notas-ajuste.entity';
import { EstadoDIANNota, EstadoNota, TipoNota } from './enums/notas-ajuste.enum';
import { ItemNotaAjuste } from './entities/items-notas-ajuste.entity';
import { NotasAjusteFilterDto } from './dto/nota-ajuste-filter.dto';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { InvoiceStatus } from 'src/facturas-ventas/enums/factura-venta.enum';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FactusService } from 'src/api-dian/services/factus.service';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';

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
      // 1. Validar factura original
      const factura = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id: createDto.facturaOriginalId },
        relations: ['client']
      });
 
      if (!factura) {
        throw new NotFoundException('Factura original no encontrada');
      }
 
      if (!factura.esElectronica()) {
        throw new BadRequestException(
          'Solo se pueden crear notas de ajuste para facturas electrónicas'
        );
      }
 
      if (factura.status !== InvoiceStatus.ACCEPTED) {
        throw new BadRequestException('Solo se pueden crear notas para facturas aceptadas por DIAN');
      }
 
      // 2. Validar que el total de la NC no exceda el saldo de la factura
      const totalNotasCredito = await this.calcularTotalNotasCredito(factura.id);
      const saldoDisponible = Number(factura.total) - totalNotasCredito;
      
      const { subtotal, iva, total, itemsCalculados } = 
        await this.calcularTotales(queryRunner, createDto.items);
 
      if (total > saldoDisponible) {
        throw new BadRequestException(
          `El total de la nota crédito ($${total}) excede el saldo disponible de la factura ($${saldoDisponible})`
        );
      }
 
      // 3. Generar número de nota
      const numeroNota = await this.generateNotaNumber(TipoNota.CREDITO);
 
      // 4. Crear nota crédito
      const notaCredito = queryRunner.manager.create(NotaAjuste, {
        tipo: TipoNota.CREDITO,
        prefijo: 'NC',
        numero: numeroNota,
        numeroCompleto: `NC-${numeroNota}`,
        metodoPago: createDto.metodoPago,
        facturaOriginalId: factura.id,
        facturaOriginalNumero: factura.comprobante_completo,
        clienteId: factura.clientId,
        concepto: createDto.concepto,
        motivo: createDto.motivo,
        fecha: createDto.fecha,
        // fechaVencimiento: createDto.fechaVencimiento,
        items: itemsCalculados,
        subtotal,
        iva,
        descuento: createDto.descuento,
        total,
        saldoPendiente: total,
        estado: EstadoNota.DRAFT,
        estadoDIAN: EstadoDIANNota.PENDIENTE,
        observaciones: createDto.observaciones,
        createdById: userId
      });
 
      const notaGuardada = await queryRunner.manager.save(NotaAjuste, notaCredito);
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
 
      if (!factura.esElectronica()) {
        throw new BadRequestException(
          'Solo se pueden crear notas de ajuste para facturas electrónicas'
        );
      }
 
      if (factura.status !== InvoiceStatus.ACCEPTED) {
        throw new BadRequestException(
          'Solo se pueden crear notas para facturas aceptadas por DIAN'
        );
      }
 
      // 2. Calcular totales
      const { subtotal, iva, total, itemsCalculados } = 
        await this.calcularTotales(queryRunner, createDto.items);
 
      // 3. Generar número de nota
      const numeroNota = await this.generateNotaNumber(TipoNota.DEBITO);
 
      // 4. Crear nota débito
      const notaDebito = queryRunner.manager.create(NotaAjuste, {
        tipo: TipoNota.DEBITO,
        prefijo: 'ND',
        numero: numeroNota,
        numeroCompleto: `ND-${numeroNota}`,
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
        estado: EstadoNota.DRAFT,
        estadoDIAN: EstadoDIANNota.PENDIENTE,
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
  async emitir(id: string): Promise<NotaAjuste> {
    const nota = await this.findOne(id);
 
    if (!nota.puedeEnviarse()) {
      throw new BadRequestException(`No se puede emitir una nota en estado ${nota.obtenerEstadoLegible()}`);
    }
 
    this.logger.log(`📤 Emitiendo ${nota.tipo} ${nota.numeroCompleto} a DIAN`);
 
    try {
      // 1. Cambiar estado
      nota.estado = EstadoNota.SENT;
      nota.estadoDIAN = EstadoDIANNota.ENVIADA;
      nota.fechaEnvioDIAN = new Date();
      nota.intentosEnvio += 1;
      await this.notaRepository.save(nota);

      // 2. Enviar a Factus/DIAN
      let respuesta: any;
      if (nota.esNotaCredito()) {
        respuesta = await this.factusService.crearNotaCredito(
          nota.facturaOriginal,
          nota.motivo,
          nota.metodoPago,
          nota.concepto,
          nota.items.map(item => ({
            code_reference: item.articulo.codigo,
            name: item.articulo.nombre,
            quantity: Number(item.cantidad),
            discount_rate: 0,
            price: Number(item.valorUnitario),
            tax_rate: Number(item.porcentajeIVA),
            unit_measure_id: Number(item.articulo.unidadmedida),
            is_excluded: 0,
            tribute_id: 1,
            withholding_taxes: []
          }))
        );
      } else {
        // Nota débito
        respuesta = await this.factusService.crearNotaDebito(
          nota.facturaOriginal,
          nota.motivo,
          nota.metodoPago,
          nota.concepto,
          nota.items.map(item => ({
            code_reference: item.articulo.codigo,
            name: item.articulo.nombre,
            quantity: Number(item.cantidad),
            discount_rate: 0,
            price: Number(item.valorUnitario),
            tax_rate: Number(item.porcentajeIVA),
            unit_measure_id: Number(item.articulo.unidadmedida),
            is_excluded: 0,
            tribute_id: 1,
            withholding_taxes: []
          }))
        );
      }
 
      // 3. Procesar respuesta
      if (respuesta.estado === 'aceptada') {
        nota.estado = EstadoNota.ACCEPTED;
        nota.estadoDIAN = EstadoDIANNota.ACEPTADA;
        nota.fechaAceptacionDIAN = new Date();
        nota.cufe = respuesta.cufe;
        nota.xmlUrl = respuesta.xmlUrl;
        nota.pdfUrl = respuesta.pdfUrl;
        nota.qrCode = respuesta.qrImageBase64;
        nota.proveedorResponse = respuesta.respuestaCompleta;
 
        if (respuesta.numeroCompleto) {
          nota.numeroCompleto = respuesta.numeroCompleto;
        }
 
        // Generar asiento contable
        await this.asientosService.generarAsientoNotaAjuste(nota, nota.createdById);
 
        // Notificar
        // TODO: await this.notificacionesService.notificarNotaAceptada(nota);
 
        this.logger.log(`✅ ${nota.tipo} ACEPTADA por DIAN: ${respuesta.cufe}`);
 
      } else {
        nota.estado = EstadoNota.REJECTED;
        nota.estadoDIAN = EstadoDIANNota.RECHAZADA;
        nota.mensajeError = respuesta.mensaje;
        nota.dianResponse = respuesta.respuestaCompleta;
 
        this.logger.error(`❌ ${nota.tipo} RECHAZADA: ${respuesta.mensaje}`);
      }
 
      await this.notaRepository.save(nota);
      return nota;
 
    } catch (error) {
      // Revertir a borrador
      nota.estado = EstadoNota.DRAFT;
      nota.estadoDIAN = EstadoDIANNota.PENDIENTE;
      nota.mensajeError = error.message;
      await this.notaRepository.save(nota);
 
      this.logger.error(`Error emitiendo nota: ${error.message}`);
      throw new InternalServerErrorException(
        `Error al emitir la nota de ajuste: ${error.message}`
      );
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
        queryBuilder.andWhere('nota.facturaOriginalNumero ILIKE :facturaNumero', {
          facturaNumero: `%${where.facturaNumero}%`
        });
      }
 
      if (where.clienteNombre) {
        queryBuilder.andWhere('cliente.nombre ILIKE :clienteNombre', {
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
        relations: ['cliente', 'facturaOriginal', 'items', 'items.articulo', 'metodoPagoRelacion', 'createdBy']
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
      throw new BadRequestException(
        'Solo se pueden modificar notas en estado borrador'
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
   * Descargar PDF de nota
   */
  async descargarPDF(id: string): Promise<{ buffer: Buffer, fileName: string }> {
    const nota = await this.findOne(id);
 
    if (!nota.cufe) {
      throw new BadRequestException('Esta nota no tiene CUFE');
    }
 
    return await this.factusService.descargarPDFNota(nota.numeroCompleto);
  }
 
  /**
   * Descargar XML de nota
   */
  async descargarXML(id: string): Promise<{ buffer: Buffer, fileName: string }> {
    const nota = await this.findOne(id);
 
    if (!nota.cufe) {
      throw new BadRequestException('Esta nota no tiene CUFE');
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
    const totalNotasCredito = notasCredito.reduce((sum, n) => sum + Number(n.total), 0);
    const totalNotasDebito = notasDebito.reduce((sum, n) => sum + Number(n.total), 0);
    const saldoNeto = totalNotasDebito - totalNotasCredito;
 
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
      
      const itemSubtotal = valorUnitario * cantidad;
      const itemIVA = itemSubtotal * (porcentajeIVA / 100);
      const valorDescuento = itemSubtotal * (descuento / 100);
      const itemTotal = itemSubtotal + itemIVA - valorDescuento;
 
      itemsCalculados.push({
        articuloId: itemDto.articuloId,
        valorUnitario,
        porcentajeIVA,
        cantidad,
        subtotal: itemSubtotal,
        valorIVA: itemIVA,
        descuento: descuento,
        valorDescuento: valorDescuento,
        total: itemTotal,
      });
 
      subtotal += itemSubtotal;
      iva += itemIVA;
      total += itemTotal;
    }
 
    return { subtotal, iva, total, itemsCalculados };
  }
 
  private async calcularTotalNotasCredito(facturaId: string): Promise<number> {
    const notasCredito = await this.notaRepository.find({
      where: {
        facturaOriginalId: facturaId,
        tipo: TipoNota.CREDITO,
        estado: EstadoNota.ACCEPTED
      }
    });
 
    return notasCredito.reduce((sum, nota) => sum + Number(nota.total), 0);
  }
 
  private async generateNotaNumber(tipo: TipoNota): Promise<string> {
    const lastNota = await this.notaRepository.findOne({
      where: { tipo },
      order: { createdAt: 'DESC' }
    });
 
    const lastNumber = lastNota ? parseInt(lastNota.numero) : 0;
    return (lastNumber + 1).toString().padStart(8, '0');
  }
}
