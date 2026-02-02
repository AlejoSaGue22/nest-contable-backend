import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateFacturaCompraDto } from './dto/create-factura-compra.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturaCompra, GastoEstado } from './entities/factura-compra.entity';
import { DataSource, Repository } from 'typeorm';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { FacturaCompraDetalle } from './entities/factura-compra-detalle.entity';
import { UpdateFacturaCompraDto } from './dto/update-factura-compra.dto';

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

                const valor = itemDto.valor;
                const porcentajeIva = itemDto.porcentajeIva || articulo.porcentajeIva || 0;
                const valorIva = valor * (porcentajeIva / 100);

                detalles.push({
                    articuloId: articulo.id,
                    descripcion: itemDto.descripcion || articulo.nombre,
                    valor,
                    porcentajeIva,
                    valorIva
                });

                subtotal += valor;
                totalIva += valorIva;
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
                subtotal,
                iva: totalIva,
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
                this.logger.error(`Error generando asiento: ${asientoError.message}`);
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

    async findAll(page = 1, limit = 10): Promise<{ data: FacturaCompra[], meta: any }> {
        try {
            const skip = (page - 1) * limit;

            const [data, total] = await this.facturaCompraRepository.findAndCount({
                relations: ['proveedor', 'items', 'items.articulo', 'createdBy'],
                order: { createdAt: 'DESC' },
                skip,
                take: limit
            });

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
            this.logger.error(`Error obteniendo gastos: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener los gastos');
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
            order: { createdAt: 'DESC' }
        });

        const ultimoNumero = ultimoGasto ? parseInt(ultimoGasto.numero) : 0;
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
