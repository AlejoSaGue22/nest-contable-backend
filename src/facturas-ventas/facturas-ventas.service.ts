import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateFacturasVentaDto } from './dto/create-facturas-venta.dto';
import { UpdateFacturasVentaDto } from './dto/update-facturas-venta.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturasVenta } from './entities/facturas-venta.entity';
import {
  DianStatus,
  FormaPago,
  InvoiceStatus,
  TipoFactura,
} from './enums/factura-venta.enum';
import { DataSource, Not, Repository } from 'typeorm';
import { ItemsFacturaVenta } from './entities/items-facturas-venta.entity';
import { PaymentStatus, MedioPago } from 'src/pagos/enums/pago.enum';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { ContabilizacionEngine } from 'src/asientos-contables/engine/contabilizacion.engine';
import { FactusService } from 'src/api-dian/services/factus.service';
import { MathUtil } from 'src/common/utils/math.util';
import { MetodoPago } from 'src/core/catalogs/entities/metodo-pago.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { PagosService } from 'src/pagos/pagos.service';

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

    @InjectRepository(Impuesto)
    private impuestoRepository: Repository<Impuesto>,

    private dataSource: DataSource,

    private asientosContablesService: AsientosContablesService,
    private contabilizacionEngine: ContabilizacionEngine,

    private factusService: FactusService,
    private pagosService: PagosService,
  ) { }

  async create(createFacturasVentaDto: CreateFacturasVentaDto, userId: string): Promise<FacturasVenta> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const client = await queryRunner.manager.findOne(Cliente, {
        where: { id: createFacturasVentaDto.clientId },
      });

      if (!client) {
        throw new NotFoundException('Cliente no encontrado');
      }

      if (createFacturasVentaDto.fechaVencimiento && createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA) {
        const fechaVencimiento = new Date(createFacturasVentaDto.fechaVencimiento);
        if (fechaVencimiento < new Date()) {
          throw new BadRequestException('La fecha de vencimiento no puede ser menor a la fecha actual');
        }
      }

      if (createFacturasVentaDto.metodoPago) {
        const metodoPago = await queryRunner.manager.findOne(MetodoPago, {
          where: { id: Number(createFacturasVentaDto.metodoPago) },
        });

        if (!metodoPago) {
          throw new NotFoundException('Método de pago no encontrado');
        }

        createFacturasVentaDto.metodoPago = metodoPago.codigo;
      }

      const { subtotal, iva, descuento, itemsCalculados } = await this.calcularTotales(queryRunner, createFacturasVentaDto.items);
      const total = MathUtil.sum(MathUtil.sub(subtotal, descuento), iva);

      const numberFactura = await this.generateInvoiceNumber();
      const prefijo = createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA
        ? 'FE'
        : 'FV';

      const { items, ...createDtoRest } = createFacturasVentaDto;

      const statusInvoice = createFacturasVentaDto.saveAsDraft === true
        ? InvoiceStatus.DRAFT
        : createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA
          ? InvoiceStatus.DRAFT
          : InvoiceStatus.ISSUED;
      // ⭐ Determinar estado de pago según si es borrador o no
      let paymentStatus: PaymentStatus;
      let saldoPendiente: number;
      let totalPagado: number;
      let dianStatus: DianStatus;

      if (statusInvoice === InvoiceStatus.DRAFT) {
        // Para BORRADORES: siempre PENDING con saldo = 0
        paymentStatus = PaymentStatus.PENDING;
        saldoPendiente = 0;
        totalPagado = 0;
        dianStatus = DianStatus.PENDING;
      } else {
        // Para NO-BORRADORES: la factura nace con saldoPendiente = total y totalPagado = 0,
        // incluso si es CONTADO, ya que el cobro automático posterior la liquidará.
        paymentStatus = PaymentStatus.PENDING;
        saldoPendiente = total;
        totalPagado = 0;
        dianStatus = createFacturasVentaDto.tipoFactura === TipoFactura.ELECTRONICA
          ? DianStatus.PENDING
          : DianStatus.ACCEPTED;
      }

      const facturaVenta = queryRunner.manager.create(FacturasVenta, {
        ...createDtoRest,
        fechaVencimiento: createFacturasVentaDto.fechaVencimiento || null,
        metodoPago: createFacturasVentaDto.metodoPago || null,
        cuentaBancariaId: createFacturasVentaDto.cuentaBancariaId || null,
        vendedor: createFacturasVentaDto.vendedor || null,
        comprobante: statusInvoice === InvoiceStatus.DRAFT ? '' : numberFactura,
        comprobante_completo: statusInvoice === InvoiceStatus.DRAFT ? '' : `${prefijo}-${numberFactura}`,
        prefijo: statusInvoice === InvoiceStatus.DRAFT ? '' : prefijo,
        createdById: userId,
        subtotal,
        descuento,
        iva,
        total,
        status: statusInvoice,
        paymentStatus,
        saldoPendiente,
        totalPagado,
        dianStatus,
      });

      const savedInvoice = await queryRunner.manager.save(FacturasVenta, facturaVenta);

      // Guardar items explícitamente para asegurar persistencia
      const itemsToSave = itemsCalculados.map((item) =>
        queryRunner.manager.create(ItemsFacturaVenta, {
          ...item,
          facturaId: savedInvoice.id,
        }),
      );
      await queryRunner.manager.save(ItemsFacturaVenta, itemsToSave);

      // ⭐ GENERAR ASIENTO CONTABLE AUTOMÁTICO PARA FACTURAS STANDARD
      if (savedInvoice.tipoFactura === TipoFactura.STANDARD && savedInvoice.status !== InvoiceStatus.DRAFT) {
        try {
          savedInvoice.items = itemsToSave;
          if (savedInvoice.cuentaBancariaId) {
            const facturaVentaConRelacion = await queryRunner.manager.findOne(FacturasVenta, {
              where: { id: savedInvoice.id },
              relations: ['cuentaBancaria'],
            });
            if (facturaVentaConRelacion) {
              savedInvoice.cuentaBancaria = facturaVentaConRelacion.cuentaBancaria;
            }
          }
          await this.contabilizacionEngine.contabilizarDocumento('FACTURA_VENTA', savedInvoice.id, userId, queryRunner);
          this.logger.log(`Asiento contable generado automáticamente para factura ${savedInvoice.comprobante_completo}`);
        } catch (asientoError) {
          await queryRunner.manager.update(FacturasVenta, { id: savedInvoice.id }, {
            status: InvoiceStatus.ERROR_ASIENTO,
            asientoError: asientoError.message,
            fechaAsientoError: new Date(),
          });
        }

        // Cobro automático si es contado y estándar (dentro de la misma transacción)
        if (createFacturasVentaDto.formaPago === FormaPago.CONTADO) {
          const medioPago = createFacturasVentaDto.metodoPago === '47' || createFacturasVentaDto.metodoPago === '42'
            ? MedioPago.BANCO
            : MedioPago.CAJA;

          await this.pagosService.registrarCobro(
            savedInvoice.id,
            {
              monto: total,
              fecha: createFacturasVentaDto.fecha || new Date().toISOString(),
              medioPago,
              cuentaBancariaId: createFacturasVentaDto.cuentaBancariaId || undefined,
              referencia: `Cobro automático contado - Factura ${savedInvoice.comprobante_completo}`,
              notas: 'Cobro generado de forma automática al emitir factura de contado.',
            },
            userId,
            queryRunner,
          );
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Factura creada exitosamente: ${savedInvoice.comprobante_completo}`);
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creando factura: ${error.message}`, error.stack);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear la factura');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(options: InvoiceFilterDto): Promise<{ data: FacturasVenta[]; meta: any }> {
    try {
      const { page = 1, limit = 10, ...where } = options;
      const skip = (page - 1) * limit;

      const queryBuilder = this.facturaVentaRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.client', 'client')
        .leftJoinAndSelect('invoice.items', 'items')
        .leftJoinAndSelect('items.articulo', 'articulo')
        .leftJoinAndSelect('invoice.createdBy', 'createdBy')
        .leftJoinAndSelect('invoice.cuentaBancaria', 'cuentaBancaria')
        .leftJoinAndSelect('invoice.canalVentaRel', 'canalVentaRel')
        .leftJoinAndSelect('invoice.metodoPagoRel', 'metodoPagoRel')
        .where('1=1');

      // Filtros
      if (where.status) {
        queryBuilder.andWhere('invoice.status = :status', {
          status: where.status,
        });
      }

      if (where.noStatus) {
        queryBuilder.andWhere('invoice.status != :noStatus', {
          noStatus: where.noStatus,
        });
      }

      if (where.dianStatus) {
        queryBuilder.andWhere('invoice.dianStatus = :dianStatus', {
          dianStatus: where.dianStatus,
        });
      }

      if (where.tipoFactura) {
        queryBuilder.andWhere('invoice.tipoFactura = :tipoFactura', {
          tipoFactura: where.tipoFactura,
        });
      }

      if (where.numeroFactura) {
        queryBuilder.andWhere('invoice.comprobante = :numeroFactura', {
          numeroFactura: where.numeroFactura,
        });
      }

      if (where.clientName) {
        queryBuilder.andWhere('client.nombre LIKE :clientName', {
          clientName: `%${where.clientName}%`,
        });
      }

      if (where.startDate && where.endDate) {
        queryBuilder.andWhere(
          'invoice.createdAt BETWEEN :startDate AND :endDate',
          {
            startDate: where.startDate,
            endDate: where.endDate,
          },
        );
      }

      queryBuilder.orderBy('invoice.createdAt', 'DESC').skip(skip).take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      const meta = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };

      return { data, meta };
    } catch (error) {
      this.logger.error(
        `Error obteniendo facturas: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Error al obtener las facturas');
    }
  }

  async update(id: string, updateDto: UpdateFacturasVentaDto): Promise<FacturasVenta> {
    if (updateDto.items && updateDto.items.length === 0) {
      throw new BadRequestException('La factura debe tener al menos un item');
    }

    if (updateDto.fechaVencimiento) {
      const fechaVencimiento = new Date(updateDto.fechaVencimiento);
      if (fechaVencimiento < new Date()) {
        throw new BadRequestException('La fecha de vencimiento no puede ser menor a la fecha actual');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id },
        relations: ['items'],
      });

      if (!invoice) {
        throw new NotFoundException(`Factura con ID ${id} no encontrada`);
      }

      if (!invoice.puedeEditarse()) {
        throw new BadRequestException(`No se pueden modificar facturas en estado ${invoice.obtenerEstadoLegible()}`);
      }

      let subtotal = invoice.subtotal;
      let iva = invoice.iva;
      let descuento = invoice.descuento;
      let total = invoice.total;

      if (updateDto.items && updateDto.items.length > 0) {
        const calc = await this.calcularTotales(queryRunner, updateDto.items);

        subtotal = calc.subtotal;
        iva = calc.iva;
        descuento = calc.descuento;
        total = MathUtil.sum(MathUtil.sub(subtotal, descuento), iva);

        // eliminar items actuales
        await queryRunner.manager.delete(ItemsFacturaVenta, { facturaId: id });

        // crear nuevos
        const newItems = calc.itemsCalculados.map((item) =>
          queryRunner.manager.create(ItemsFacturaVenta, {
            ...item,
            facturaId: id,
          }),
        );

        await queryRunner.manager.save(ItemsFacturaVenta, newItems);
      }

      const updatePayload: any = {
        clientId: updateDto.clientId,
        canalVenta: Number(updateDto.canalVenta) || invoice.canalVenta,
        vendedor: updateDto.vendedor || null,
        fecha: updateDto.fecha,
        formaPago: updateDto.formaPago,
        metodoPago: updateDto.metodoPago || null,
        cuentaBancariaId: updateDto.cuentaBancariaId || null,
        fechaVencimiento: updateDto.fechaVencimiento || null,
        tipoFactura: updateDto.tipoFactura,
        subtotal,
        iva,
        descuento,
        total,
      };

      // ⭐ Si la factura sigue siendo DRAFT, resetear estados de pago
      if (invoice.status === InvoiceStatus.DRAFT) {
        updatePayload.paymentStatus = PaymentStatus.PENDING;
        updatePayload.saldoPendiente = 0;
        updatePayload.totalPagado = 0;
        updatePayload.dianStatus = DianStatus.PENDING;
      }

      this.logger.debug(
        `Actualizando factura ${id} con payload: ${JSON.stringify(updatePayload)}`,
      );

      // update directo (más rápido que save)
      await queryRunner.manager.update(FacturasVenta, { id }, updatePayload);

      await queryRunner.commitTransaction();

      return await this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error actualizando factura ${id}: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
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
        relations: [
          'client',
          'client.tipoDocumentoRel',
          'items',
          'items.articulo',
          'items.impuestoRel',
          'metodoPagoRel',
          'canalVentaRel',
          'createdBy',
          'cuentaBancaria',
          'cuentaBancaria.banco',
        ],
      });

      if (!invoice) {
        throw new NotFoundException(`Factura con ID ${id} no encontrada`);
      }

      return invoice;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error obteniendo factura ${id}: ${error.message}`,
        error.stack,
      );
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
  async emitir(id: string, userId: string): Promise<FacturasVenta> {
    const factura = await this.findOne(id);

    if (!factura.puedeEmitirse()) {
      throw new BadRequestException(
        `No se puede emitir una factura en estado ${factura.obtenerEstadoLegible()}`,
      );
    }

    this.logger.log(
      `Emitiendo factura electrónica: ${factura.comprobante_completo}`,
    );

    const numberFactura = await this.generateInvoiceNumber();

    try {
      // 1. Cambiar estado a "enviando a DIAN"
      // ✅ FIX: update() selectivo — NUNCA escribe subtotal/iva/descuento/total
      await this.facturaVentaRepository.update(
        { id },
        {
          status: InvoiceStatus.PENDING_DIAN,
          dianStatus: DianStatus.SENT,
          fechaEnvioDIAN: new Date(),
          intentosEnvio: (factura.intentosEnvio ?? 0) + 1,
        },
      );

      // 2. ✅ ENVIAR A FACTUS/DIAN (REAL)
      this.logger.log('📤 Enviando factura a Factus...');
      const respuesta = await this.factusService.crearYValidarFactura(
        factura,
        numberFactura,
      );

      // 3. Procesar respuesta
      if (respuesta.estado === 'aceptada') {
        const updateAceptada: Partial<FacturasVenta> = {
          status: InvoiceStatus.ACCEPTED,
          dianStatus: DianStatus.ACCEPTED,
          fechaAceptacionDIAN: new Date(),
          cufe: respuesta.cufe,
          xmlUrl: respuesta.xmlUrl,
          pdfUrl: respuesta.pdfUrl,
          qrCode: respuesta.qrImageBase64,
          proveedorResponse: respuesta.respuestaCompleta,
          prefijo: 'FE',
          comprobante: numberFactura,
          paymentStatus: PaymentStatus.PENDING,
          saldoPendiente: factura.total,
          totalPagado: 0,
        };

        if (respuesta.numeroCompleto) {
          updateAceptada.comprobante_completo = respuesta.numeroCompleto;
          factura.comprobante_completo = respuesta.numeroCompleto;
        }

        // Primero actualizamos en BD para que la contabilidad y el cobro lean datos correctos
        await this.facturaVentaRepository.update({ id }, updateAceptada);

        // ✅ GENERAR ASIENTO CONTABLE TRAS ACEPTACIÓN
        const facturaParaAsiento = await this.findOne(id);

        try {
          await this.contabilizacionEngine.contabilizarDocumento(
            'FACTURA_VENTA',
            facturaParaAsiento.id,
            userId,
          );
          this.logger.log(
            `Asiento contable generado para factura electrónica ${facturaParaAsiento.comprobante_completo}`,
          );
        } catch (asientoError) {
          await this.facturaVentaRepository.update({ id }, {
            status: InvoiceStatus.ERROR_ASIENTO,
            asientoError: asientoError.message,
            fechaAsientoError: new Date(),
          });
          this.logger.error(
            `Error generando asiento contable para FE: ${asientoError.message}`,
          );
        }

        // Si es de contado, registrar cobro automático (usando transacción independiente para cobros de FE)
        if (factura.formaPago === FormaPago.CONTADO) {
          try {
            const medioPago = factura.metodoPago === '47' || factura.metodoPago === '42'
              ? MedioPago.BANCO
              : MedioPago.CAJA;

            await this.pagosService.registrarCobro(
              factura.id,
              {
                monto: Number(factura.total),
                fecha: factura.fecha ? factura.fecha.toISOString() : new Date().toISOString(),
                medioPago,
                cuentaBancariaId: factura.cuentaBancariaId || undefined,
                referencia: `Cobro automático contado - Factura ${factura.comprobante_completo}`,
                notas: 'Cobro generado de forma automática al emitir factura electrónica de contado.',
              },
              userId,
            );
            this.logger.log(`Cobro automático registrado para factura electrónica ${factura.comprobante_completo}`);
          } catch (cobroError) {
            this.logger.error(`Error en cobro automático para factura electrónica: ${cobroError.message}`);
          }
        }
        this.logger.log(`✅ Factura ACEPTADA por DIAN: ${respuesta.cufe}`);
      } else {
        // Rechazada
        await this.facturaVentaRepository.update(
          { id },
          {
            status: InvoiceStatus.REJECTED,
            dianStatus: DianStatus.REJECTED,
            mensajeError: respuesta.mensaje || '',
            dianResponse: respuesta.respuestaCompleta,
          },
        );
        this.logger.error(
          `❌ Factura RECHAZADA por DIAN: ${respuesta.mensaje}`,
        );
      }

      return await this.findOne(id);
    } catch (error) {
      // Revertir estado en caso de error
      await this.facturaVentaRepository.update(
        { id },
        {
          status: InvoiceStatus.DRAFT,
          dianStatus: DianStatus.PENDING,
          mensajeError: error.message,
        },
      );
      this.logger.error(`Error emitiendo factura: ${error.message}`);
      throw new InternalServerErrorException(
        `Error al emitir factura electrónica: ${error.message}`,
      );
    }
  }

  async reintentarEnvio(id: string, userId: string): Promise<FacturasVenta> {
    const factura = await this.findOne(id);
    if (!factura.puedeReintentarse()) {
      throw new BadRequestException('No se puede reintentar el envío.');
    }
    // ✅ FIX: update() selectivo
    await this.facturaVentaRepository.update(
      { id },
      {
        status: InvoiceStatus.DRAFT,
        dianStatus: DianStatus.PENDING,
        mensajeError: '',
      },
    );
    return await this.emitir(id, userId);
  }

  async emitirEstandar(id: string, userId: string): Promise<FacturasVenta> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id },
        relations: ['items', 'client', 'cuentaBancaria'],
      });

      if (!factura) {
        throw new NotFoundException('Factura no encontrada');
      }

      if (factura.tipoFactura !== TipoFactura.STANDARD) {
        throw new BadRequestException(
          'Solo se pueden emitir facturas estándar desde borrador',
        );
      }

      if (factura.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `No se puede emitir una factura en estado ${factura.obtenerEstadoLegible()}`,
        );
      }

      const numberFactura = await this.generateInvoiceNumber();
      const prefijo = 'FV';

      // Nace con saldo pendiente para que el cobro posterior lo liquide
      const paymentStatus = PaymentStatus.PENDING;
      const saldoPendiente = factura.total;
      const totalPagado = 0;

      await queryRunner.manager.update(
        FacturasVenta,
        { id },
        {
          status: InvoiceStatus.ISSUED,
          paymentStatus,
          saldoPendiente,
          totalPagado,
          dianStatus: DianStatus.ACCEPTED,
          prefijo,
          comprobante: numberFactura,
          comprobante_completo: `${prefijo}-${numberFactura}`,
        },
      );

      const updatedInvoice = await queryRunner.manager.findOne(FacturasVenta, {
        where: { id },
        relations: ['items', 'client', 'cuentaBancaria'],
      });

      if (!updatedInvoice) {
        throw new NotFoundException('Factura no encontrada');
      }

      try {
        await this.contabilizacionEngine.contabilizarDocumento(
          'FACTURA_VENTA',
          updatedInvoice.id,
          userId,
          queryRunner,
        );
        this.logger.log(
          `Asiento contable generado para factura estándar ${updatedInvoice.comprobante_completo}`,
        );
      } catch (asientoError) {
        await queryRunner.manager.update(
          FacturasVenta,
          { id },
          {
            status: InvoiceStatus.ERROR_ASIENTO,
            asientoError: asientoError.message,
            fechaAsientoError: new Date(),
          },
        );
        this.logger.error(
          `Error generando asiento contable para factura estándar: ${asientoError.message}`,
        );
      }

      // Cobro automático si es contado (dentro de la misma transacción)
      if (factura.formaPago === FormaPago.CONTADO) {
        const medioPago = factura.metodoPago === '47' || factura.metodoPago === '42'
          ? MedioPago.BANCO
          : MedioPago.CAJA;

        await this.pagosService.registrarCobro(
          factura.id,
          {
            monto: Number(factura.total),
            fecha: factura.fecha ? factura.fecha.toISOString() : new Date().toISOString(),
            medioPago,
            cuentaBancariaId: factura.cuentaBancariaId || undefined,
            referencia: `Cobro automático contado - Factura ${updatedInvoice.comprobante_completo}`,
            notas: 'Cobro generado de forma automática al emitir factura de contado.',
          },
          userId,
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Factura estándar emitida: ${updatedInvoice.comprobante_completo}`,
      );
      return await this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error emitiendo factura estándar: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al emitir factura estándar: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async registrarPago(
    id: string,
    metodoPago: string,
    userId: string,
  ): Promise<FacturasVenta> {
    const factura = await this.findOne(id);
    if (
      !factura.estaAceptada() &&
      factura.tipoFactura === TipoFactura.ELECTRONICA
    ) {
      throw new BadRequestException(
        'Solo se puede registrar pago de facturas aceptadas por DIAN',
      );
    }

    // ✅ FIX: update() selectivo — no toca campos financieros
    await this.facturaVentaRepository.update(
      { id },
      { status: InvoiceStatus.PAID, metodoPago },
    );

    const updatedInvoice = await this.findOne(id);

    // Generar asiento contable de pago (Cartera)
    try {
      await this.asientosContablesService.generarAsientoPagoFacturaVenta(
        updatedInvoice,
        userId,
      );
      this.logger.log(
        `Asiento de pago generado para factura ${updatedInvoice.comprobante_completo}`,
      );
    } catch (error) {
      this.logger.error(`Error generando asiento de pago: ${error.message}`);
    }

    return updatedInvoice;
  }

  async anular(
    id: string,
    motivo: string,
    userId: string,
  ): Promise<FacturasVenta> {
    const factura = await this.findOne(id);
    if (factura.tipoFactura === TipoFactura.ELECTRONICA) {
      if (!factura.puedeAnularseElectronica()) {
        throw new BadRequestException('No se puede anular esta factura.');
      }
    } else {
      if (!factura.puedeAnularseEstandar()) {
        throw new BadRequestException('No se puede anular esta factura.');
      }
    }

    try {
      // ✅ FIX: update() selectivo — no toca campos financieros
      await this.facturaVentaRepository.update(
        { id },
        {
          status: InvoiceStatus.CANCELLED,
          dianStatus: DianStatus.CANCELLED,
          paymentStatus: PaymentStatus.CANCELLED,
          observaciones: `Anulada: ${motivo}`,
        },
      );

      const updatedInvoice = await this.findOne(id);

      // Generar asiento contable de anulación
      try {
        await this.asientosContablesService.generarAsientoAnulacionFacturaVenta(
          updatedInvoice,
          userId,
        );
        this.logger.log(
          `Asiento de anulación generado para factura ${updatedInvoice.comprobante_completo}`,
        );
      } catch (asientoError) {
        await this.facturaVentaRepository.update(
          { id },
          {
            status: InvoiceStatus.ERROR_ASIENTO,
            asientoError: asientoError.message,
            fechaAsientoError: new Date(),
          },
        );
        this.logger.error(
          `Error generando asiento de anulación: ${asientoError.message}`,
        );
      }

      return await this.findOne(id);
    } catch (error) {
      this.logger.error(`Error anulando factura: ${error.message}`);
      throw new InternalServerErrorException('Error al anular factura');
    }
  }

  async descargarPDF(
    id: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const factura = await this.findOne(id);
    if (!factura.comprobante_completo) {
      throw new BadRequestException(
        'Esta factura no tiene Número de Comprobante Completo.',
      );
    }
    return await this.factusService.descargarPDF(factura.comprobante_completo);
  }

  async descargarXML(
    id: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const factura = await this.findOne(id);
    if (!factura.comprobante_completo) {
      throw new BadRequestException(
        'Esta factura no tiene Número de Comprobante Completo.',
      );
    }
    return await this.factusService.descargarXML(factura.comprobante_completo);
  }

  async getEstadisticas(): Promise<any> {
    const facturas = await this.facturaVentaRepository.find();
    return {
      total: facturas.length,
      aceptadas: facturas.filter((f) => f.status === InvoiceStatus.ACCEPTED)
        .length,
      rechazadas: facturas.filter((f) => f.status === InvoiceStatus.REJECTED)
        .length,
      montoTotal: facturas.reduce(
        (sum, f) => MathUtil.sum(sum, Number(f.total)),
        0,
      ),
    };
  }

  private async calcularTotales(
    queryRunner: any,
    items: any[],
  ): Promise<{
    subtotal: number;
    iva: number;
    descuento: number;
    itemsCalculados: Partial<ItemsFacturaVenta>[];
  }> {
    let subtotal = 0;
    let iva = 0;
    let descuento = 0;
    const itemsCalculados: Partial<ItemsFacturaVenta>[] = [];

    for (const itemDto of items) {
      const product = await queryRunner.manager.findOne(Articulo, {
        where: { id: itemDto.articuloId },
        relations: ['categoriaArticulo', 'categoriaArticulo.cuentaPrincipal'],
      });

      if (!product)
        throw new NotFoundException(
          `Producto no encontrado: ${itemDto.articuloId}`,
        );
      if (!product.isActive)
        throw new BadRequestException(
          `El producto ${product.nombre} no está activo`,
        );

      const unitPrice = Number(itemDto.unitPrice) || product.precio || 0;
      if (unitPrice <= 0) {
        throw new BadRequestException(
          `El precio unitario del artículo ${product.nombre} debe ser mayor a cero`,
        );
      }
      const quantity = Number(itemDto.quantity) || 0;
      if (quantity <= 0) {
        throw new BadRequestException(
          `La cantidad del artículo ${product.nombre} debe ser mayor a cero`,
        );
      }
      const totalSinDescuento = MathUtil.mul(unitPrice, quantity);
      const discountRate = Number(itemDto.discount) || 0;
      const itemDiscount = MathUtil.percentage(totalSinDescuento, discountRate);

      const itemSubtotal = MathUtil.sub(totalSinDescuento, itemDiscount);

      const taxRate = Number(itemDto.iva) || 0;
      const itemIva = MathUtil.percentage(itemSubtotal, taxRate);

      let impuestoIdSeleccionado: string | undefined;
      if (itemDto.impuestoId) {
        const impuesto = await queryRunner.manager.findOne(Impuesto, {
          where: { id: itemDto.impuestoId, activo: true },
        });
        if (!impuesto)
          throw new NotFoundException(
            `Impuesto ${itemDto.impuestoId} no encontrado`,
          );
        impuestoIdSeleccionado = impuesto.id;
      } else {
        impuestoIdSeleccionado = product.impuestoId || undefined;
      }

      const itemTotal = MathUtil.sum(itemSubtotal, itemIva);

      itemsCalculados.push({
        articuloId: product.id,
        description: itemDto.description || product.observacion,
        unitPrice,
        iva: taxRate,
        impuestoId: impuestoIdSeleccionado,
        quantity,
        subtotal: itemSubtotal,
        valor_iva: itemIva,
        importe: MathUtil.sub(itemSubtotal, itemDiscount),
        discount: discountRate,
        valor_discount: itemDiscount,
        total: itemTotal,
      });

      subtotal = MathUtil.sum(subtotal, itemSubtotal);
      iva = MathUtil.sum(iva, itemIva);
      descuento = MathUtil.sum(descuento, itemDiscount);
    }

    return {
      subtotal,
      iva,
      descuento,
      itemsCalculados,
    };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const lastInvoice = await this.facturaVentaRepository.findOne({
      where: {
        comprobante: Not(''),
      },
      order: { createdAt: 'DESC' },
    });

    const lastNumber = lastInvoice ? parseInt(lastInvoice.comprobante, 10) : 0;
    const nextNumber = isNaN(lastNumber) ? 0 : lastNumber;
    return (nextNumber + 1).toString().padStart(8, '0');
  }

  async reintentarAsiento(id: string, userId: string): Promise<FacturasVenta> {
    const factura = await this.findOne(id);

    if (!factura) {
      throw new NotFoundException('Factura no encontrada.');
    }

    if (factura.status !== InvoiceStatus.ERROR_ASIENTO) {
      throw new BadRequestException(
        'Solo se pueden reintentar facturas con error en el asiento.',
      );
    }

    try {
      await this.contabilizacionEngine.contabilizarDocumento(
        'FACTURA_VENTA',
        factura.id,
        userId,
      );

      // ✅ FIX: update() selectivo — restaurar estado sin tocar campos financieros
      const nuevoStatus =
        factura.tipoFactura === TipoFactura.ELECTRONICA
          ? InvoiceStatus.ACCEPTED
          : InvoiceStatus.ISSUED;

      await this.facturaVentaRepository.update(
        { id },
        {
          status: nuevoStatus,
          asientoError: null,
          fechaAsientoError: undefined,
        },
      );

      this.logger.log(
        `Asiento reintentado exitosamente para factura ${factura.comprobante_completo}`,
      );
      return await this.findOne(id);
    } catch (error) {
      await this.facturaVentaRepository.update(
        { id },
        { asientoError: error.message, fechaAsientoError: new Date() },
      );
      this.logger.error(
        `Fallo reintento de asiento para factura ${factura.comprobante_completo}: ${error.message}`,
      );
      throw new BadRequestException(
        `El asiento sigue fallando: ${error.message}`,
      );
    }
  }

  async enviarEmail(
    id: string,
    email: string,
    userId: string,
  ): Promise<FacturasVenta> {
    const factura = await this.findOne(id);

    if (!factura) {
      throw new NotFoundException('Factura no encontrada.');
    }

    if (factura.status !== InvoiceStatus.ACCEPTED) {
      throw new BadRequestException(
        'Solo se pueden enviar facturas aceptadas.',
      );
    }

    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email inválido.');
    }

    // ✅ Usar factusService para envío
    try {
      await this.factusService.sendEmail(factura.comprobante_completo, email);
    } catch (error) {
      this.logger.error(
        `Fallo envío email factura ${factura.comprobante_completo}: ${error.message}`,
      );
      throw new BadRequestException(
        `El envío de email sigue fallando: ${error.message}`,
      );
    }

    return factura;
  }
}
