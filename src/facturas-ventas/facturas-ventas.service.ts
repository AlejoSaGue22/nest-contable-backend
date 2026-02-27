import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateFacturasVentaDto } from './dto/create-facturas-venta.dto';
import { UpdateFacturasVentaDto } from './dto/update-facturas-venta.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DianStatus, FacturasVenta, InvoiceStatus, TipoFactura } from './entities/facturas-venta.entity';
import { DataSource, Repository } from 'typeorm';
import { ItemsFacturaVenta } from './entities/items-facturas-venta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { User } from 'src/users/entities/user.entity';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { Articulo } from 'src/articulos/entities/articulos.entity';
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

      const facturaVenta = queryRunner.manager.create(FacturasVenta, {
        ...createFacturasVentaDto,
        comprobante: numberFactura,
        comprobante_completo: `${prefijo}-${numberFactura}`,
        prefijo,
        createdById: userId,
        subtotal,
        descuento,
        iva,
        total,
        status: createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA ? InvoiceStatus.DRAFT : InvoiceStatus.ISSUED,
        dianStatus: createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA ? DianStatus.PENDING : DianStatus.ACCEPTED,
        items: itemsCalculados
      });

      const savedInvoice = await queryRunner.manager.save(FacturasVenta, facturaVenta);

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

      if (where.clientName) {
        queryBuilder.andWhere('client.nombre ILIKE :clientName', { 
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

  async findOne(id: string): Promise<FacturasVenta> {
    try {
      const invoice = await this.facturaVentaRepository.findOne({
        where: { id },
        relations: ['client', 'client.tipoDocumentoRel', 'items', 'items.articulo', 'createdBy'],
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

  async update(id: string, updateDto: UpdateFacturasVentaDto): Promise<FacturasVenta> {
    const invoice = await this.findOne(id);

    if (!invoice.puedeEditarse()) {
      throw new BadRequestException(
        `No se pueden modificar facturas en estado ${invoice.obtenerEstadoLegible()}`
      );
    }

    try {
      const updatedInvoice = await this.facturaVentaRepository.preload({
        id,
        ...updateDto,
      });

      return await this.facturaVentaRepository.save(updatedInvoice!);

    } catch (error) {
      this.logger.error(`Error actualizando factura ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar la factura');
    }
  }

  async remove(id: string): Promise<void> {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.ISSUED || invoice.status === InvoiceStatus.ACCEPTED) {
      throw new BadRequestException('No se puede eliminar una factura ya emitida o aceptada');
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
  async emitir(id: string, userId: string): Promise<FacturasVenta> {
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

  async registrarPago(id: string, metodoPago: string): Promise<FacturasVenta> {
    const factura = await this.findOne(id);
    if (!factura.estaAceptada() && factura.tipoFactura === TipoFactura.ELECTRONICA) {
      throw new BadRequestException('Solo se puede registrar pago de facturas aceptadas por DIAN');
    }
    factura.status = InvoiceStatus.PAID;
    factura.metodoPago = metodoPago;
    await this.facturaVentaRepository.save(factura);
    return factura;
  }

  async anular(id: string, motivo: string): Promise<FacturasVenta> {
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
      factura.observaciones = `Anulada: ${motivo}`;
      await this.facturaVentaRepository.save(factura);
      return factura;
    } catch (error) {
      this.logger.error(`Error anulando factura: ${error.message}`);
      throw new InternalServerErrorException('Error al anular factura');
    }
  }

  async descargarPDF(id: string): Promise<Buffer> {
    const factura = await this.findOne(id);
    if (!factura.cufe) {
      throw new BadRequestException('Esta factura no tiene CUFE.');
    }
    return await this.factusService.descargarPDF(factura.cufe);
  }

  async descargarXML(id: string): Promise<Buffer> {
    const factura = await this.findOne(id);
    if (!factura.cufe) {
      throw new BadRequestException('Esta factura no tiene CUFE.');
    }
    return await this.factusService.descargarXML(factura.cufe);
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

      const unitPrice = itemDto.unitPrice || product.precio;
      const itemSubtotal = unitPrice * itemDto.quantity;
      const itemIva = itemSubtotal * (product.impuesto / 100);
      const itemDiscount = itemDto.discount ? (itemSubtotal * (itemDto.discount / 100)) : 0;
      const itemTotal = itemSubtotal + itemIva - itemDiscount;

      itemsCalculados.push({
        articuloId: product.id,
        description: itemDto.description || product.observacion,
        unitPrice,
        iva: product.impuesto,
        quantity: itemDto.quantity,
        subtotal: itemSubtotal,
        valor_iva: itemIva,
        discount: itemDto.discount || 0,
        valor_discount: itemDiscount,
        total: itemTotal,
      });

      subtotal += itemSubtotal;
      iva += itemIva;
      descuento += itemDiscount;
    }

    return { subtotal, iva, descuento, itemsCalculados };
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
