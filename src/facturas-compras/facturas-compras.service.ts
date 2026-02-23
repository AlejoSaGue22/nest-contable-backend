import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateFacturaCompraDto } from './dto/create-factura-compra.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturaCompra, GastoEstado } from './entities/factura-compra.entity';
import { DataSource, Repository } from 'typeorm';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { FacturaCompraDetalle } from './entities/factura-compra-detalle.entity';
import { InvoiceFilterDto } from 'src/facturas-ventas/dto/invoice-filter.dto';

@Injectable()
export class FacturasComprasService {
    private readonly logger = new Logger(FacturasComprasService.name);

    constructor(
        @InjectRepository(FacturaCompra)
        private facturaCompraRepository: Repository<FacturaCompra>,

        @InjectRepository(FacturaCompraDetalle)
        private itemsFacturaCompraRepository: Repository<FacturaCompraDetalle>,

        @InjectRepository(Proveedor)
        private proveedorRepository: Repository<Proveedor>,

        @InjectRepository(Articulo)
        private articuloRepository: Repository<Articulo>,

        private dataSource: DataSource,
        private asientosContablesService: AsientosContablesService,
    ) { }

    async create(createFacturaCompraDto: CreateFacturaCompraDto, userId: string): Promise<FacturaCompra> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const proveedor = await queryRunner.manager.findOne(Proveedor, {
                where: { id: createFacturaCompraDto.proveedorId }
            });

            if (!proveedor) {
                throw new NotFoundException('Proveedor no encontrado');
            }

            let subtotal = 0;
            let totalIva = 0;
            let descuento = 0;
            const detalles: Partial<FacturaCompraDetalle>[] = [];

            // Procesar items
            for (const itemDto of createFacturaCompraDto.items) {
                const articulo = await queryRunner.manager.findOne(Articulo, {
                    where: { id: itemDto.articuloId },
                    relations: ['cuentaContable', 'cuentaIva']
                });

                if (!articulo) {
                    throw new NotFoundException(`Artículo ${itemDto.articuloId} no encontrado`);
                }

                if (!articulo.cuentaContable) {
                    throw new BadRequestException(
                        `El artículo ${articulo.nombre} no tiene cuenta contable asignada`
                    );
                }

                const unitPrice = itemDto.unitPrice | articulo.precio;
                const porcentajeIva = itemDto.iva || articulo.porcentajeIva || 0;

                const itemSubtotal = itemDto.quantity * unitPrice;
                const descuentoValor = (itemDto.discount / 100) * itemSubtotal;
                const valorIva = itemSubtotal * (porcentajeIva / 100);
                const itemTotal = (itemSubtotal - descuentoValor) + valorIva;

                detalles.push({
                    articuloId: articulo.id,
                    descripcion: itemDto.descripcion || articulo.nombre,
                    unitPrice,
                    quantity: itemDto.quantity,
                    porcentajeIva,
                    valorIva,
                    valorSubtotal: itemSubtotal,
                    descuento,
                    valorDescuento: descuentoValor,
                    itemTotal
                });

                subtotal += itemSubtotal;
                totalIva += valorIva;
                descuento += descuentoValor;
            }

            const total = subtotal + totalIva;
            const numero = await this.generarNumeroGasto(queryRunner);

            // Crear gasto
            const gasto = queryRunner.manager.create(FacturaCompra, {
                numero,
                fecha: createFacturaCompraDto.fecha,
                proveedorId: proveedor.id,
                observaciones: createFacturaCompraDto.observaciones,
                numeroFacturaProveedor: createFacturaCompraDto.numero,
                formaPago: createFacturaCompraDto.formaPago,
                metodoPago: createFacturaCompraDto.metodoPago,
                subtotal,
                iva: totalIva,
                descuento,
                total,
                estado: GastoEstado.REGISTRADO,
                createdById: userId,
                items: detalles
            });

            const gastoGuardado = await queryRunner.manager.save(FacturaCompra, gasto);

            // ⭐ GENERAR ASIENTO CONTABLE AUTOMÁTICO
            try {
                await this.asientosContablesService.generarAsientoGasto(gastoGuardado, userId);
                this.logger.log(`Asiento contable generado para gasto ${gastoGuardado.numero}`);
            } catch (asientoError) {
                await queryRunner.manager.update(
                    FacturaCompra,
                    { id: gastoGuardado.id },
                    {
                        estado: GastoEstado.ERROR_ASIENTO,
                        asientoError: asientoError.message,
                        fechaAsientoError: new Date()
                    }
                );

                this.logger.error(
                    `Error generando asiento para gasto ${gastoGuardado.numero}: ${asientoError.message}`
                );

            }

            await queryRunner.commitTransaction();
            this.logger.log(`Gasto creado: ${gastoGuardado.numero}`);

            return gastoGuardado;

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error creando gasto: ${error.message}`, error.stack);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new InternalServerErrorException('Error al crear el gasto');
        } finally {
            await queryRunner.release();
        }
    }

    async findAll(options: InvoiceFilterDto): Promise<{ data: FacturaCompra[], meta: any }> {
        try {
            const { offset = 1, limit = 10, ...where } = options;
            const skip = (offset < 1 ? 0 : (offset - 1)) * limit;

            const queryBuilder = this.facturaCompraRepository
                .createQueryBuilder('invoice')
                .leftJoinAndSelect('invoice.proveedor', 'proveedor')
                .leftJoinAndSelect('invoice.items', 'items')
                .leftJoinAndSelect('invoice.createdBy', 'createdBy')
                .where('1=1');

            // Aplicar filtros
            if (where.status) {
                queryBuilder.andWhere('invoice.estado = :status', { status: where.status });
            }

            if (where.type) {
                queryBuilder.andWhere('invoice.type = :type', { type: where.type });
            }

            if (where.providerName) {
                queryBuilder.andWhere('proveedor.nombre ILIKE :proveedorName', {
                    proveedorName: `%${where.clientName}%`
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
            this.logger.error(`Error obteniendo facturas de compra: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener las facturas de compra');
        }
    }

    async findOne(id: string): Promise<FacturaCompra> {
        try {
            const factura = await this.facturaCompraRepository.findOne({
                where: { id },
                relations: ['proveedor', 'items', 'items.articulo', 'createdBy']
            });

            if (!factura) {
                throw new NotFoundException(`Factura de compra ${id} no encontrada`);
            }

            return factura;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error obteniendo factura de compra: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener la factura de compra');
        }
    }

    private async generarNumeroGasto(queryRunner: any): Promise<string> {
        const ultimoGasto = await queryRunner.manager.findOne(FacturaCompra, {
            where: {},
            order: { numero: 'DESC' }
        });

        const ultimoNumero = ultimoGasto ? parseInt(ultimoGasto.numero?.split('-')[1]) : 0;
        return `FC-${(ultimoNumero + 1).toString().padStart(6, '0')}`;
    }

    async anular(id: string): Promise<FacturaCompra> {
        const factura = await this.findOne(id);

        if (factura.estado === GastoEstado.ANULADO) {
            throw new BadRequestException('La factura de compra ya está anulada');
        }

        factura.estado = GastoEstado.ANULADO;
        return await this.facturaCompraRepository.save(factura);
    }
}
