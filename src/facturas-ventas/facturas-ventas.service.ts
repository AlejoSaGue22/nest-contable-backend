import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateFacturasVentaDto } from './dto/create-facturas-venta.dto';
import { UpdateFacturasVentaDto } from './dto/update-facturas-venta.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturasVenta, InvoiceStatus } from './entities/facturas-venta.entity';
import { DataSource, Repository } from 'typeorm';
import { ItemsFacturaVenta } from './entities/items-facturas-venta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { User } from 'src/users/entities/user.entity';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { Articulo } from 'src/articulos/entities/articulos.entity';

@Injectable()
export class FacturasVentasService {
  private readonly logger = new Logger(FacturasVentasService.name);

  constructor(
    @InjectRepository(FacturasVenta)
    private readonly facturaVentaRepository: Repository<FacturasVenta>,

    @InjectRepository(ItemsFacturaVenta) private ItemsfacturaVentaRepository: Repository<ItemsFacturaVenta>,

    @InjectRepository(Cliente) private ClienteRepository: Repository<Cliente>,

    @InjectRepository(Articulo) private ArticuloRepository: Repository<Articulo>,

    private dataSource: DataSource,

    private asientosContablesService: AsientosContablesService,
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

      const invoiceItems: Partial<FacturasVenta>[] = [];
      let subtotal = 0;
      let iva = 0;
      let descuento = 0;

      for (const itemDto of createFacturasVentaDto.items) {
        const product = await queryRunner.manager.findOne(Articulo, {
          where: { id: itemDto.articuloId },
          relations: ['cuentaContable', 'cuentaIva']
        })

        if (!product) {
          throw new NotFoundException(`Producto no encontrado: ${itemDto.articuloId}`);
        }

        if (!product.isActive) {
          throw new BadRequestException(`El producto ${product.nombre} no está activo`);
        }

        // Validar que el artículo tenga cuenta contable
        if (!product.cuentaContable) {
          throw new BadRequestException(
            `El artículo del producto ${product.nombre} no tiene cuenta contable asignada`
          );
        }

        // Validar stock para ventas
        // if (product.stock < itemDto.quantity) {
        //   throw new BadRequestException(
        //     `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock}, Solicitado: ${itemDto.quantity}`
        //   );
        // }

        const unitPrice = itemDto.unitPrice || product.precio;
        const ivaPercent = itemDto.iva !== undefined ? itemDto.iva : product.impuesto;

        const itemSubtotal = unitPrice * itemDto.quantity;
        const itemDiscountValor = itemSubtotal * (itemDto.discount / 100);
        const itemIvaValor = itemSubtotal * (ivaPercent / 100);
        const itemTotal = (itemSubtotal + itemIvaValor) - itemDiscountValor;

        const invoiceItem: Partial<ItemsFacturaVenta> = {
          articuloId: product.id,
          description: itemDto.description || product.observacion,
          unitPrice: unitPrice,
          iva: ivaPercent,
          valor_iva: itemIvaValor,
          quantity: itemDto.quantity,
          discount: itemDto.discount,
          valor_discount: itemDiscountValor,
          importe: itemSubtotal - itemDiscountValor,
          subtotal: itemSubtotal,
          total: itemTotal,
        };

        invoiceItems.push(invoiceItem);
        subtotal += itemSubtotal;
        iva += itemIvaValor;
        descuento += itemDiscountValor;

        // Actualizar stock para ventas
        // if (createInvoiceDto.type === InvoiceType.SALE) {
        //   await queryRunner.manager.decrement(
        //     Product,
        //     { id: product.id },
        //     'stock',
        //     itemDto.quantity
        //   );
        // }
      }

      const total = (subtotal - descuento) + iva;
      const numberFactura = await this.generateInvoiceNumber();
      const prefijo = 'FAC';
      // Create Invoice
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
        status: InvoiceStatus.ISSUED,
        items: invoiceItems
      });

      const savedInvoice = await queryRunner.manager.save(FacturasVenta, facturaVenta);

      // ⭐ GENERAR ASIENTO CONTABLE AUTOMÁTICO
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
        // No revertir la transacción, solo loguear el error
        // El asiento se puede generar manualmente después
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
      const { offset = 1, limit = 10, ...where } = options;
      const skip = (offset < 1 ? 0 : (offset - 1)) * limit;

      const queryBuilder = this.facturaVentaRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.client', 'client')
        .leftJoinAndSelect('invoice.items', 'items')
        .leftJoinAndSelect('invoice.createdBy', 'createdBy')
        .where('1=1');

      // Aplicar filtros
      if (where.status) {
        queryBuilder.andWhere('invoice.status = :status', { status: where.status });
      }

      if (where.type) {
        queryBuilder.andWhere('invoice.type = :type', { type: where.type });
      }

      if (where.clientName) {
        queryBuilder.andWhere('client.name ILIKE :clientName', {
          clientName: `%${where.clientName}%`
        });
      }

      if (where.startDate && where.endDate) {
        queryBuilder.andWhere('invoice.createdAt BETWEEN :startDate AND :endDate', {
          startDate: where.startDate,
          endDate: where.endDate,
        });
      }

      // Ordenar y paginar
      queryBuilder
        .orderBy('invoice.createdAt', 'DESC')
        .skip(skip)
        .take(limit);

      const [data, total] = await queryBuilder.getManyAndCount();

      const meta = {
        offset,
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

  async findOne(id: string) {
    try {
      const invoice = await this.facturaVentaRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.client', 'client')
        .leftJoinAndSelect('invoice.items', 'items')
        .leftJoinAndSelect('items.articulo', 'articulo') // ← Relación con producto
        .leftJoinAndSelect('invoice.createdBy', 'createdBy')
        .where('invoice.id = :id', { id })
        .select([
          'invoice',
          'client',
          'items',
          'articulo.id',
          'articulo.nombre',
          'articulo.codigo', // Solo los campos que necesitas
          'createdBy'
        ])
        .getOne();

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

  async update(id: string, updateFacturasVentaDto: UpdateFacturasVentaDto) {
    const invoice = await this.findOne(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden modificar facturas en estado borrador');
    }

    try {
      const updatedInvoice = await this.facturaVentaRepository.preload({
        id,
        ...updateFacturasVentaDto,
      });

      return await this.facturaVentaRepository.save(updatedInvoice!);

    } catch (error) {
      this.logger.error(`Error actualizando factura ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar la factura');
    }

  }

  async remove(id: string): Promise<void> {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.ISSUED) {
      throw new BadRequestException('No se puede eliminar una factura ya emitida');
    }

    try {
      await this.facturaVentaRepository.softDelete(id);
      this.logger.log(`Factura eliminada: ${id}`);

    } catch (error) {
      this.logger.error(`Error eliminando factura ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al eliminar la factura');
    }
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
