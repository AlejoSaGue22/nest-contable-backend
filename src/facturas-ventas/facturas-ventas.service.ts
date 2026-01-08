import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateFacturasVentaDto } from './dto/create-facturas-venta.dto';
import { UpdateFacturasVentaDto } from './dto/update-facturas-venta.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturasVenta, InvoiceStatus } from './entities/facturas-venta.entity';
import { DataSource, Repository } from 'typeorm';
import { ItemsFacturaVenta } from './entities/items-facturas-venta.entity';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Producto } from 'src/productos/entities/producto.entity';
import { User } from 'src/users/entities/user.entity';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { InvoiceFilterDto } from './dto/invoice-filter.dto';

@Injectable()
export class FacturasVentasService {
  private readonly logger = new Logger(FacturasVentasService.name);

  constructor(
    @InjectRepository(FacturasVenta)
     private readonly facturaVentaRepository: Repository<FacturasVenta>,

    @InjectRepository(ItemsFacturaVenta) private ItemsfacturaVentaRepository: Repository<ItemsFacturaVenta>,

    @InjectRepository(Cliente) private ClienteRepository: Repository<Cliente>,

    @InjectRepository(Producto) private ProductoRepository: Repository<Producto>,

    private dataSource: DataSource,
  ){}

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

       console.log("User ID: ", userId);

       for (const itemDto of createFacturasVentaDto.items) {
              const product = await queryRunner.manager.findOne(Producto, {
                  where: { id: itemDto.productoId }
              })

              if (!product) {
                  throw new NotFoundException(`Producto no encontrado: ${itemDto.productoId}`);
              }

              if (!product.isActive) {
                throw new BadRequestException(`El producto ${product.nombre} no está activo`);
              }

          // Validar stock para ventas
          // if (product.stock < itemDto.quantity) {
          //   throw new BadRequestException(
          //     `Stock insuficiente para ${product.nombre}. Disponible: ${product.stock}, Solicitado: ${itemDto.quantity}`
          //   );
          // }

              const unitPrice = itemDto.unitPrice || parseInt(product.precioventa1);
              const ivaPercent = itemDto.iva !== undefined ? itemDto.iva : parseFloat(product.impuesto);

              const itemSubtotal = unitPrice * itemDto.quantity;
              const itemDiscountValor = itemSubtotal * (itemDto.discount / 100);
              const itemIvaValor = itemSubtotal * (ivaPercent / 100);
              const itemTotal = (itemSubtotal + itemIvaValor) - itemDiscountValor;

              const invoiceItem: Partial<ItemsFacturaVenta> = {
                    productoId: product.id,
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

        console.log('Offset:', offset);
        console.log('Limit:', limit);
        console.log('Skip:', skip);


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

        // if (where.type) {
        //   queryBuilder.andWhere('invoice.type = :type', { type: where.type });
        // }

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
      const invoice = await this.facturaVentaRepository.findOne({
        where: { id },
        relations: ['clientId', 'items', 'createdBy'],
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
