import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateFacturasVentaDto } from './dto/create-facturas-venta.dto';
import { UpdateFacturasVentaDto } from './dto/update-facturas-venta.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturasVenta} from './entities/facturas-venta.entity';
import { DianStatus, FormaPago, InvoiceStatus, TipoFactura } from './enums/factura-venta.enum';
import { DataSource, Repository } from 'typeorm';
import { ItemsFacturaVenta } from './entities/items-facturas-venta.entity';
import { PaymentStatus } from 'src/pagos/enums/pago.enum';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { FactusService } from 'src/api-dian/services/factus.service';

@Injectable()
export class FacturasVentasService {
  private readonly logger = new Logger(FacturasVentasService.name);

  constructor(
    @InjectRepository(FacturasVenta)
    private readonly facturaVentaRepository: Repository<FacturasVenta>,

    @InjectRepository(ItemsFacturaVenta)
    private ItemsfacturaVentaRepository: Repository<ItemsFacturaVenta>,

    @InjectRepository(Cliente)
    private ClienteRepository: Repository<Cliente>,

    @InjectRepository(Articulo)
    private ArticuloRepository: Repository<Articulo>,

    private dataSource: DataSource,

    private asientosContablesService: AsientosContablesService,

    private factusService: FactusService,
  ) { }

  async create(createFacturasVentaDto: CreateFacturasVentaDto, userId: string): Promise<FacturasVenta> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const client = await queryRunner.manager.findOne(Cliente, {
        where: { id: createFacturasVentaDto.clientId }
      });

      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }


      const { subtotal, iva, descuento, itemsCalculados } = await this.calcularTotales(queryRunner, createFacturasVentaDto.items);
      const total = (subtotal - descuento) + iva;

      const numberFactura = await this.generateInvoiceNumber();
      const prefijo = createFacturasVentaDto.prefijo || (createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA ? 'FE' : 'FAC');

      const { items, ...createDtoRest } = createFacturasVentaDto;

      const statusInvoice = createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA ? InvoiceStatus.DRAFT 
                            : InvoiceStatus.ISSUED;

      const facturaVenta = queryRunner.manager.create(FacturasVenta, {
        ...createDtoRest,
        metodoPago: createFacturasVentaDto.metodoPago || null,
        vendedor: createFacturasVentaDto.vendedor || null,
        comprobante: numberFactura,
        comprobante_completo: `${prefijo}-${numberFactura}`,
        prefijo,
        createdById: userId,
        subtotal,
        descuento,
        iva,
        total,
        status: statusInvoice,
        paymentStatus: createFacturasVentaDto.formaPago === FormaPago.CREDITO ? PaymentStatus.PENDING : PaymentStatus.PAID,
        saldoPendiente: createFacturasVentaDto.formaPago === FormaPago.CREDITO ? total : 0,
        totalPagado: createFacturasVentaDto.formaPago === FormaPago.CREDITO ? 0 : total,
        dianStatus: createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA ? DianStatus.PENDING : DianStatus.ACCEPTED,
      });

      const savedInvoice = await queryRunner.manager.save(FacturasVenta, facturaVenta);

      // Guardar items explícitamente para asegurar persistencia
      const itemsToSave = itemsCalculados.map(item => 
        queryRunner.manager.create(ItemsFacturaVenta, {
          ...item,
          facturaId: savedInvoice.id
        })
      );
      await queryRunner.manager.save(ItemsFacturaVenta, itemsToSave);

      // ⭐ GENERAR ASIENTO CONTABLE AUTOMÁTICO PARA FACTURAS STANDARD
      if (savedInvoice.tipoFactura === TipoFactura.STANDARD) {
        try {
          await this.asientosContablesService.generarAsientoFacturaVenta(savedInvoice, userId);
          this.logger.log(`Asiento contable generado automáticamente para factura ${savedInvoice.comprobante_completo}`);
        } catch (asientoError) {
          await queryRunner.manager.update(
            FacturasVenta,
            { id: savedInvoice.id },
            {
              status: InvoiceStatus.ERROR_ASIENTO,
              asientoError: asientoError.message,
              fechaAsientoError: new Date()
            }
          );
          this.logger.error(`Error generando asiento contable: ${asientoError.message}`);
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Factura creada exitosamente: ${savedInvoice.comprobante_completo}`);
      return savedInvoice;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creando factura: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear la factura');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(options: InvoiceFilterDto): Promise<{ data: FacturasVenta[], meta: any }> {
    try {
      const { page = 1, limit = 10, ...where } = options;
      const skip = (page - 1) * limit;

      const queryBuilder = this.facturaVentaRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.client', 'client')
        .leftJoinAndSelect('invoice.items', 'items')
        .leftJoinAndSelect('invoice.createdBy', 'createdBy')
        .where('1=1');

      // Filtros
      if (where.status) {
        queryBuilder.andWhere('invoice.status = :status', { status: where.status });
      }

      if (where.dianStatus) {
        queryBuilder.andWhere('invoice.dianStatus = :dianStatus', { dianStatus: where.dianStatus });
      }

      if (where.tipoFactura) {
        queryBuilder.andWhere('invoice.tipoFactura = :tipoFactura', { tipoFactura: where.tipoFactura });
      }

      if (where.numeroFactura) {
        queryBuilder.andWhere('invoice.comprobante = :numeroFactura', { numeroFactura: where.numeroFactura });
      }

      if (where.clientName) {
        queryBuilder.andWhere('client.nombre LIKE :clientName', { 
          clientName: `%${where.clientName}%` 
        });
      }

      if (where.startDate && where.endDate) {
        queryBuilder.andWhere('invoice.createdAt BETWEEN :startDate AND :endDate', {
          startDate: where.startDate,
          endDate: where.endDate,
        });
      }

      queryBuilder
        .orderBy('invoice.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      const meta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };

      return { data, meta };

    } catch (error) {
      this.logger.error(`Error obteniendo facturas: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al obtener las facturas');
    }
  }

  async update(id: string, updateDto: UpdateFacturasVentaDto): Promise<FacturasVenta> {

    if (updateDto.items && updateDto.items.length === 0) {
      throw new BadRequestException('La factura debe tener al menos un item');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

  try {

    const invoice = await queryRunner.manager.findOne(FacturasVenta, {
      where: { id },
      relations: ['items']
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    if (!invoice.puedeEditarse()) {
      throw new BadRequestException(
        `No se pueden modificar facturas en estado ${invoice.obtenerEstadoLegible()}`
      );
    }

    let subtotal = invoice.subtotal;
    let iva = invoice.iva;
    let descuento = invoice.descuento;
    let total = invoice.total;

    // =========================
    // Recalcular items si vienen
    // =========================

    if (updateDto.items && updateDto.items.length > 0) {

      const calc = await this.calcularTotales(queryRunner, updateDto.items);

      subtotal = calc.subtotal;
      iva = calc.iva;
      descuento = calc.descuento;
      total = (subtotal - descuento) + iva;

      // eliminar items actuales
      await queryRunner.manager.delete(ItemsFacturaVenta, { facturaId: id });

      // crear nuevos
      const newItems = calc.itemsCalculados.map(item =>
        queryRunner.manager.create(ItemsFacturaVenta, {
          ...item,
          facturaId: id
        })
      );

      await queryRunner.manager.save(ItemsFacturaVenta, newItems);

    }

    const updatePayload = {
          clientId: updateDto.clientId,
          canalVenta: Number(updateDto.canalVenta) || invoice.canalVenta,
          vendedor: updateDto.vendedor || null,
          fecha: updateDto.fecha,
          formaPago: updateDto.formaPago,
          metodoPago: updateDto.metodoPago || null,
          fechaVencimiento: updateDto.fechaVencimiento || null,
          tipoFactura: updateDto.tipoFactura,
          subtotal: Math.round(subtotal),
          iva: Math.round(iva),
          descuento: Math.round(descuento),
          total: Math.round(total)
    };

    this.logger.debug(`Actualizando factura ${id} con payload: ${JSON.stringify(updatePayload)}`);

    // update directo (más rápido que save)
    await queryRunner.manager.update(
      FacturasVenta,
      { id },
      updatePayload
    );

    await queryRunner.commitTransaction();

    return await this.findOne(id);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    this.logger.error(
      `Error actualizando factura ${id}: ${error.message}`,
      error.stack
    );
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new InternalServerErrorException('Error al actualizar la factura');

  } finally {
    await queryRunner.release();
  }

  }

  async findOne(id: string): Promise<FacturasVenta> {
    try {
      const invoice = await this.facturaVentaRepository.findOne({
        where: { id },
        relations: ['client', 'client.tipoDocumentoRel',
                   'items', 'items.articulo', 'metodoPagoRel', 'canalVentaRel', 'createdBy'],
      });

      if (!invoice) {
        throw new NotFoundException(`Factura con ID ${id} no encontrada`);
      }

      return invoice;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error obteniendo factura ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al obtener la factura');
    }
  }  

  async remove(id: string): Promise<void> {
    const invoice = await this.findOne(id);

    if (invoice.status != InvoiceStatus.DRAFT) {
      throw new BadRequestException('No se puede eliminar una factura que no está en estado borrador');
    }

    try {
      await this.facturaVentaRepository.softDelete(id);
      this.logger.log(`Factura eliminada: ${id}`);
    } catch (error) {
      this.logger.error(`Error eliminando factura ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al eliminar la factura');
    }
  }

  /**
   * Emitir factura electrónica (enviar a DIAN vía Factus)
   */
  async emitir(id: string, userId: string): Promise<FacturasVenta> 
  {
    const factura = await this.findOne(id);

    // Validar que puede emitirse
    if (!factura.puedeEmitirse()) {
      throw new BadRequestException(
        `No se puede emitir una factura en estado ${factura.obtenerEstadoLegible()}`
      );
    }

    this.logger.log(`Emitiendo factura electrónica: ${factura.comprobante_completo}`);

    try {
      // 1. Cambiar estado a "enviando a DIAN"
      factura.status = InvoiceStatus.PENDING_DIAN;
      factura.dianStatus = DianStatus.SENT;
      factura.fechaEnvioDIAN = new Date();
      factura.intentosEnvio += 1;
      await this.facturaVentaRepository.save(factura);

      // 2. ✅ ENVIAR A FACTUS/DIAN (REAL)
      this.logger.log('📤 Enviando factura a Factus...');
      const respuesta = await this.factusService.crearYValidarFactura(factura);

      // 3. Procesar respuesta
      if (respuesta.estado === 'aceptada') {
        factura.status = InvoiceStatus.ACCEPTED;
        factura.dianStatus = DianStatus.ACCEPTED;
        factura.fechaAceptacionDIAN = new Date();
        factura.cufe = respuesta.cufe;
        factura.xmlUrl = respuesta.xmlUrl;
        factura.pdfUrl = respuesta.pdfUrl;
        factura.qrCode = respuesta.qrImageBase64;
        factura.proveedorResponse = respuesta.respuestaCompleta;

        if (respuesta.numeroCompleto) {
          factura.comprobante_completo = respuesta.numeroCompleto;
        }

        // ✅ GENERAR ASIENTO CONTABLE TRAS ACEPTACIÓN
        try {
          await this.asientosContablesService.generarAsientoFacturaVenta(factura, userId);
          this.logger.log(`Asiento contable generado para factura electrónica ${factura.comprobante_completo}`);
        } catch (asientoError) {
          factura.status = InvoiceStatus.ERROR_ASIENTO;
          factura.asientoError = asientoError.message;
          factura.fechaAsientoError = new Date();
          this.logger.error(`Error generando asiento contable para FE: ${asientoError.message}`);
        }

        this.logger.log(`✅ Factura ACEPTADA por DIAN: ${respuesta.cufe}`);
      } else {
        factura.status = InvoiceStatus.REJECTED;
        factura.dianStatus = DianStatus.REJECTED;
        factura.mensajeError = respuesta.mensaje || '';
        factura.dianResponse = respuesta.respuestaCompleta;
        this.logger.error(`❌ Factura RECHAZADA por DIAN: ${respuesta.mensaje}`);
      }

      await this.facturaVentaRepository.save(factura);
      return factura;
      //return respuesta;

    } catch (error) {
      factura.status = InvoiceStatus.DRAFT;
      factura.dianStatus = DianStatus.PENDING;
      factura.mensajeError = error.message;
      await this.facturaVentaRepository.save(factura);
      this.logger.error(`Error emitiendo factura: ${error.message}`);
      throw new InternalServerErrorException(`Error al emitir factura electrónica: ${error.message}`);
    }
  } 

  async reintentarEnvio(id: string, userId: string): Promise<FacturasVenta> {
    const factura = await this.findOne(id);
    if (!factura.puedeReintentarse()) {
      throw new BadRequestException('No se puede reintentar el envío.');
    }
    factura.status = InvoiceStatus.DRAFT;
    factura.dianStatus = DianStatus.PENDING;
    factura.mensajeError = '';
    await this.facturaVentaRepository.save(factura);
    return await this.emitir(id, userId);
  }

  async registrarPago(id: string, metodoPago: string, userId: string): Promise<FacturasVenta> {
    const factura = await this.findOne(id);
    if (!factura.estaAceptada() && factura.tipoFactura === TipoFactura.ELECTRONICA) {
      throw new BadRequestException('Solo se puede registrar pago de facturas aceptadas por DIAN');
    }
    factura.status = InvoiceStatus.PAID;
    factura.metodoPago = metodoPago;
    
    const savedInvoice = await this.facturaVentaRepository.save(factura);

    // Generar asiento contable de pago (Cartera)
    try {
      await this.asientosContablesService.generarAsientoPagoFacturaVenta(savedInvoice, userId);
      this.logger.log(`Asiento de pago generado para factura ${savedInvoice.comprobante_completo}`);
    } catch (error) {
      this.logger.error(`Error generando asiento de pago: ${error.message}`);
      // No lanzamos excepción para no revertir el estado del pago, 
      // pero el usuario debería ser notificado de alguna forma (asientoError en factura si aplica)
    }

    return savedInvoice;
  }

  async anular(id: string, motivo: string, userId: string): Promise<FacturasVenta> {
    const factura = await this.findOne(id);
    if (!factura.puedeAnularse()) {
      throw new BadRequestException('No se puede anular esta factura.');
    }
    
    try {
      if (factura.tipoFactura === TipoFactura.ELECTRONICA) {
        await this.factusService.crearNotaCredito(factura, motivo);
      }
      factura.status = InvoiceStatus.CANCELLED;
      factura.dianStatus = DianStatus.CANCELLED;
      factura.paymentStatus = PaymentStatus.CANCELLED;
      factura.observaciones = `Anulada: ${motivo}`;

      const savedInvoice = await this.facturaVentaRepository.save(factura);

      // Generar asiento contable de anulación
      try {
        await this.asientosContablesService.generarAsientoAnulacionFacturaVenta(savedInvoice, userId);
        this.logger.log(`Asiento de anulación generado para factura ${savedInvoice.comprobante_completo}`);
      } catch (asientoError) {
        await this.facturaVentaRepository.update(
          { id: savedInvoice.id },
          {
            status: InvoiceStatus.ERROR_ASIENTO,
            asientoError: asientoError.message,
            fechaAsientoError: new Date()
          }
        );
        this.logger.error(`Error generando asiento de anulación: ${asientoError.message}`);
      }

      return savedInvoice;
    } catch (error) {
      this.logger.error(`Error anulando factura: ${error.message}`);
      throw new InternalServerErrorException('Error al anular factura');
    }
  }

  async descargarPDF(id: string): Promise<{ buffer: Buffer, fileName: string }> {
    const factura = await this.findOne(id);
    if (!factura.comprobante_completo) {
      throw new BadRequestException('Esta factura no tiene Número de Comprobante Completo.');
    }
    return await this.factusService.descargarPDF(factura.comprobante_completo);
  }

  async descargarXML(id: string): Promise<{ buffer: Buffer, fileName: string }> {
    const factura = await this.findOne(id);
    if (!factura.comprobante_completo) {
      throw new BadRequestException('Esta factura no tiene Número de Comprobante Completo.');
    }
    return await this.factusService.descargarXML(factura.comprobante_completo);
  }

  async getEstadisticas(): Promise<any> {
    const facturas = await this.facturaVentaRepository.find();
    return {
      total: facturas.length,
      aceptadas: facturas.filter(f => f.status === InvoiceStatus.ACCEPTED).length,
      rechazadas: facturas.filter(f => f.status === InvoiceStatus.REJECTED).length,
      montoTotal: facturas.reduce((sum, f) => sum + Number(f.total), 0),
    };
  }

  private async calcularTotales(queryRunner: any, items: any[]): Promise<{ subtotal: number, iva: number, descuento: number, itemsCalculados: Partial<ItemsFacturaVenta>[] }> {
    let subtotal = 0;
    let iva = 0;
    let descuento = 0;
    const itemsCalculados: Partial<ItemsFacturaVenta>[] = [];

    for (const itemDto of items) {
      const product = await queryRunner.manager.findOne(Articulo, {
        where: { id: itemDto.articuloId },
        relations: ['cuentaContable']
      });

      if (!product) throw new NotFoundException(`Producto no encontrado: ${itemDto.articuloId}`);
      if (!product.isActive) throw new BadRequestException(`El producto ${product.nombre} no está activo`);

      const unitPrice = Math.round(Number(itemDto.unitPrice) || product.precio || 0);
      const quantity = Number(itemDto.quantity) || 0;
      const itemSubtotal = Math.round(unitPrice * quantity);
      
      const taxRate = Number(itemDto.iva) || 0;
      const itemIva = Math.round(itemSubtotal * (taxRate / 100));
      
      const discountRate = Number(itemDto.discount) || 0;
      const itemDiscount = Math.round(itemSubtotal * (discountRate / 100));
      
      const itemTotal = Math.round(itemSubtotal + itemIva - itemDiscount);

      itemsCalculados.push({
        articuloId: product.id,
        description: itemDto.description || product.observacion,
        unitPrice,
        iva: taxRate,
        quantity,
        subtotal: itemSubtotal,
        valor_iva: itemIva,
        importe: Math.round(itemSubtotal - itemDiscount),
        discount: discountRate,
        valor_discount: itemDiscount,
        total: itemTotal,
      });

      subtotal += itemSubtotal;
      iva += itemIva;
      descuento += itemDiscount;
    }

    return { 
      subtotal: Math.round(subtotal), 
      iva: Math.round(iva), 
      descuento: Math.round(descuento), 
      itemsCalculados 
    };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const lastInvoice = await this.facturaVentaRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });
    const lastNumber = lastInvoice ? parseInt(lastInvoice.comprobante) : 0;
    return (lastNumber + 1).toString().padStart(8, '0');
  }
}
