import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateFacturaCompraDto } from './dto/create-factura-compra.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { FacturaCompra, GastoEstado } from './entities/factura-compra.entity';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Pago } from 'src/pagos/entities/pago.entity';
import { PaymentStatus } from 'src/pagos/enums/pago.enum';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { FacturaCompraDetalle } from './entities/factura-compra-detalle.entity';
import { InvoiceFilterDto } from 'src/facturas-ventas/dto/invoice-filter.dto';
import { UpdateFacturaCompraDto } from './dto/update-factura-compra.dto';
import { CreateFacturaCompraItemDto } from './dto/create-items-factura-compra.dto';
import { FormaPago } from 'src/facturas-ventas/enums/factura-venta.enum';
import { ComprasFilterDto } from './dto/compras-filter.dto';
import { MathUtil } from 'src/common/utils/math.util';
import { MetodoPago } from 'src/core/catalogs/entities/metodo-pago.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';


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

        @InjectRepository(Impuesto)
        private impuestoRepository: Repository<Impuesto>,

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
                    relations: ['categoriaArticulo', 'categoriaArticulo.cuentaPrincipal', 'impuestoRel']
                });

                if (!articulo) {
                    throw new NotFoundException(`Artículo ${itemDto.articuloId} no encontrado`);
                }

                if(createFacturaCompraDto.fechaVencimiento){
                    const fechaVencimiento = new Date(createFacturaCompraDto.fechaVencimiento);
                    if(fechaVencimiento < new Date()){
                        throw new BadRequestException('La fecha de vencimiento no puede ser menor a la fecha actual');
                    }
                }

                if (!articulo.categoriaArticulo?.cuentaPrincipal) {
                    throw new BadRequestException(`El artículo ${articulo.nombre} no tiene cuenta contable principal asignada en su categoría`);
                }

                if (createFacturaCompraDto.metodoPago) {
                    const metodoPago = await queryRunner.manager.findOne(MetodoPago, {
                        where: { id: Number(createFacturaCompraDto.metodoPago) }
                    });

                    if (!metodoPago) {
                        throw new NotFoundException('Método de pago no encontrado');
                    }

                    createFacturaCompraDto.metodoPago = metodoPago.codigo;
                }

                const quantity = Number(itemDto.quantity) || 0;
                if (quantity <= 0) {
                    throw new BadRequestException(`La cantidad del artículo ${articulo.nombre} debe ser mayor a cero`);
                }
                const unitPrice = itemDto.unitPrice || articulo.precio || 0;
                if (unitPrice <= 0) {
                    throw new BadRequestException(`El precio unitario del artículo ${articulo.nombre} debe ser mayor a cero`);
                }
                const totalSinDescuento = MathUtil.mul(itemDto.quantity, unitPrice);

                const descuentoPorcentaje = itemDto.discount || 0;
                const descuentoValor = MathUtil.percentage(totalSinDescuento, descuentoPorcentaje);

                const itemSubtotal = MathUtil.sub(totalSinDescuento, descuentoValor);

                const porcentajeIva = itemDto.iva || articulo.porcentajeIva;
                let impuestoIdSeleccionado: string | undefined = undefined;

                if (itemDto.impuestoId) {
                    const impuesto = await queryRunner.manager.findOne(Impuesto, {
                        where: { id: itemDto.impuestoId, activo: true }
                    });
                    if (!impuesto) {
                        throw new NotFoundException(`Impuesto ${itemDto.impuestoId} no encontrado`);
                    }
                    impuestoIdSeleccionado = impuesto.id;
                } else {
                    impuestoIdSeleccionado = articulo.impuestoId || undefined;
                }

                const valorIva = MathUtil.percentage(itemSubtotal, porcentajeIva);
                
                // (itemSubtotal - descuentoValor) + valorIva 
                const itemTotal = MathUtil.sum(itemSubtotal, valorIva);

                detalles.push({
                    articuloId: articulo.id,
                    descripcion: itemDto.descripcion || articulo.nombre,
                    unitPrice,
                    quantity: itemDto.quantity,
                    porcentajeIva,
                    impuestoId: impuestoIdSeleccionado,
                    valorIva,
                    valorSubtotal: itemSubtotal,
                    descuento: itemDto.discount || 0,
                    valorDescuento: descuentoValor,
                    itemTotal
                });

                subtotal = MathUtil.sum(subtotal, itemSubtotal);
                totalIva = MathUtil.sum(totalIva, valorIva);
                descuento = MathUtil.sum(descuento, descuentoValor);
            }

            const total = MathUtil.sum(subtotal, totalIva);
            const isDraft = createFacturaCompraDto.isDraft;
            const numero = isDraft == 'draft' ? null : await this.generarNumeroGasto(queryRunner);

            // ⭐ Determinar estado de pago según si es borrador o no
            let paymentStatus: PaymentStatus;
            let saldoPendiente: number;
            let totalPagado: number;

            if (isDraft == 'draft') {
              // Para BORRADORES: siempre PENDING con saldo = 0
              paymentStatus = PaymentStatus.PENDING;
              saldoPendiente = 0;
              totalPagado = 0;
            } else {
              // Para NO-BORRADORES: aplicar lógica de formaPago
              paymentStatus = createFacturaCompraDto.formaPago === FormaPago.CREDITO ? PaymentStatus.PENDING : PaymentStatus.PAID;
              saldoPendiente = createFacturaCompraDto.formaPago === FormaPago.CREDITO ? total : 0;
              totalPagado = createFacturaCompraDto.formaPago === FormaPago.CREDITO ? 0 : total;
            }

            // Crear gasto - Extraemos datos para evitar pasar el array de items del DTO directamente a la entidad
            const { items, ...dtoRest } = createFacturaCompraDto;
            
            const gasto = queryRunner.manager.create(FacturaCompra, {
                ...dtoRest,
                numero: numero || null,
                numeroFacturaProveedor: createFacturaCompraDto.numeroFacturaProveedor,
                fecha: createFacturaCompraDto.fecha,
                proveedorId: proveedor.id,
                observaciones: createFacturaCompraDto.observaciones,
                formaPago: createFacturaCompraDto.formaPago,
                metodoPago: createFacturaCompraDto.metodoPago || null,
                fechaVencimiento: createFacturaCompraDto.fechaVencimiento?.trim() === '' ? null : createFacturaCompraDto.fechaVencimiento,
                subtotal,
                iva: totalIva,
                descuento,
                total,
                estado: isDraft == 'draft' ? GastoEstado.BORRADOR : GastoEstado.REGISTRADO,
                paymentStatus,
                saldoPendiente,
                totalPagado,
                createdById: userId,
            });

            const gastoGuardado = await queryRunner.manager.save(FacturaCompra, gasto);

            const itemsToSave = detalles.map(item => 
                queryRunner.manager.create(FacturaCompraDetalle, {
                    ...item,
                    facturaCompraId: gastoGuardado.id
                })
            );
            await queryRunner.manager.save(FacturaCompraDetalle, itemsToSave);


            // ⭐ GENERAR ASIENTO CONTABLE AUTOMÁTICO
            console.log('isDraft', isDraft);
            if (!isDraft) {
                console.log('isDraft2', isDraft);
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

                    this.logger.error(`Error generando asiento para gasto ${gastoGuardado.numero}: ${asientoError.message}`);
                }
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

    async findAll(options: ComprasFilterDto): Promise<{ data: FacturaCompra[], meta: any }> {
        try {
            const { page = 1, limit = 10, ...where } = options;
            const skip = (page < 1 ? 0 : (page - 1)) * limit;

            const queryBuilder = this.facturaCompraRepository
                .createQueryBuilder('invoice')
                .leftJoinAndSelect('invoice.proveedor', 'proveedor')
                .leftJoinAndSelect('invoice.items', 'items')
                .leftJoinAndSelect('items.articulo', 'articulo')
                .leftJoinAndSelect('invoice.createdBy', 'createdBy')
                .where('1=1');

            // Aplicar filtros
            if (where.estado) {
                queryBuilder.andWhere('invoice.estado = :estado', { estado: where.estado });
            }

            if (where.paymentStatus) {
                queryBuilder.andWhere('invoice.paymentStatus = :paymentStatus', { paymentStatus: where.paymentStatus });
            }

            // if (where.providerName) {
            //     queryBuilder.andWhere('proveedor.nombre LIKE :proveedorName', {
            //         proveedorName: `%${where.providerName}%`
            //     });
            // }

            if (where.numeroFactura) {
                queryBuilder.andWhere('invoice.numero = :numeroFactura', { numeroFactura: where.numeroFactura });
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
                page,
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
                relations: ['proveedor', 'items', 'items.articulo', 'items.impuestoRel', 'metodoPagoRel', 'createdBy']
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

    async registrar(id: string, userId: string): Promise<FacturaCompra> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const factura = await queryRunner.manager.findOne(FacturaCompra, {
                where: { id },
                relations: ['items', 'items.articulo', 'proveedor']
            });

            if (!factura) {
                throw new NotFoundException(`Factura de compra ${id} no encontrada`);
            }

            if (factura.estado !== GastoEstado.BORRADOR) {
                throw new BadRequestException('Solo se pueden registrar facturas en estado borrador');
            }

            
            const numero = await this.generarNumeroGasto(queryRunner);

            // ✅ FIX: update() selectivo — no toca campos financieros (subtotal, iva, descuento, total)
            await queryRunner.manager.update(
                FacturaCompra,
                { id },
                { numero, estado: GastoEstado.REGISTRADO },
            );

            // Re-fetch con datos frescos desde BD para el asiento contable
            const facturaActualizada = await queryRunner.manager.findOne(FacturaCompra, {
                where: { id },
                relations: ['items', 'items.articulo', 'proveedor']
            });

            
            try {
                await this.asientosContablesService.generarAsientoGasto(facturaActualizada!, userId);
                this.logger.log(`Asiento contable generado para factura registrada ${numero}`);
            } catch (asientoError) {
                await queryRunner.manager.update(
                    FacturaCompra,
                    { id },
                    {
                        estado: GastoEstado.ERROR_ASIENTO,
                        asientoError: asientoError.message,
                        fechaAsientoError: new Date()
                    }
                );
                this.logger.error(`Error generando asiento para factura registrada ${numero}: ${asientoError.message}`);
            }

            await queryRunner.commitTransaction();
            return await this.findOne(id);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error registrando factura ${id}: ${error.message}`, error.stack);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    private async generarNumeroGasto(queryRunner: any): Promise<string> {
        const queryBuilder = queryRunner.manager.createQueryBuilder(FacturaCompra, 'gasto')
            .where('gasto.numero IS NOT NULL')
            .orderBy('gasto.numero', 'DESC');

        const ultimoGasto = await queryBuilder.getOne();

        const ultimoNumero = ultimoGasto ? parseInt(ultimoGasto.numero?.split('-')[1]) : 0;
        return `FC-${(ultimoNumero + 1).toString().padStart(6, '0')}`;
    }

    async anular(id: string, userId: string): Promise<FacturaCompra> {
        const factura = await this.findOne(id);

        if (factura.estado === GastoEstado.ANULADO) {
            throw new BadRequestException('La factura de compra ya está anulada');
        }

        // ✅ Validar: no anular si tiene pagos parciales registrados
        if (factura.paymentStatus === PaymentStatus.PARTIAL || factura.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException(
                'No se puede anular una factura de compra con pagos registrados.'
            );
        }

        // ✅ FIX: update() selectivo — no toca campos financieros (subtotal, iva, descuento, total)
        await this.facturaCompraRepository.update(
            { id },
            { estado: GastoEstado.ANULADO, paymentStatus: PaymentStatus.CANCELLED },
        );

        const facturaAnulada = await this.findOne(id);

        // ✅ Generar asiento de anulación
        try {
            await this.asientosContablesService.generarAsientoAnulacionFacturaCompra(facturaAnulada, userId);
        } catch (asientoError) {
            await this.facturaCompraRepository.update(
                { id },
                {
                    estado: GastoEstado.ERROR_ASIENTO,
                    asientoError: asientoError.message,
                    fechaAsientoError: new Date(),
                },
            );
            this.logger.error(`Error generando asiento anulación compra ${facturaAnulada.numero}: ${asientoError.message}`);
        }

        return await this.findOne(id);
    }

    async update(id: string, updateFacturaCompraDto: UpdateFacturaCompraDto): Promise<FacturaCompra> {
        if (updateFacturaCompraDto.items && updateFacturaCompraDto.items.length === 0) {
            throw new BadRequestException('La factura debe tener al menos un item');
        }

        if(updateFacturaCompraDto.fechaVencimiento){
            const fechaVencimiento = new Date(updateFacturaCompraDto.fechaVencimiento);
            if(fechaVencimiento < new Date()){
                throw new BadRequestException('La fecha de vencimiento no puede ser menor a la fecha actual');
            }
        }

        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const factura = await queryRunner.manager.findOne(FacturaCompra, {
                where: { id },
                relations: ['items', 'items.articulo']
            });

            if (!factura) {
                throw new NotFoundException(`Factura de compra ${id} no encontrada`);
            }

            if (!factura.puedeEditarse()) {
                throw new BadRequestException('La factura de compra no se puede editar');
            }

            let subtotal = 0;
            let totalIva = 0;
            let descuento = 0;
            let total = 0;

            if (updateFacturaCompraDto.items && updateFacturaCompraDto.items.length > 0) {
                const calc = await this.calcularTotales(queryRunner, updateFacturaCompraDto.items);

                subtotal = calc.subtotal;
                totalIva = calc.totalIva;
                descuento = calc.descuento;
                total = MathUtil.sum(MathUtil.sub(subtotal, descuento), totalIva);

                // eliminar items actuales
                await queryRunner.manager.delete(FacturaCompraDetalle, { facturaId: id });

                // guardar items
                const itemsToSave = calc.detalles.map(item =>
                    queryRunner.manager.create(FacturaCompraDetalle, {
                        ...item,
                        facturaId: factura.id
                    })
                );

                await queryRunner.manager.save(FacturaCompraDetalle, itemsToSave);
            }

            const updatePayload: any = {
                proveedorId: updateFacturaCompraDto.proveedorId,
                fecha: updateFacturaCompraDto.fecha,
                formaPago: updateFacturaCompraDto.formaPago,
                metodoPago: updateFacturaCompraDto.metodoPago || null,
                fechaVencimiento: updateFacturaCompraDto.fechaVencimiento?.trim() === '' ? null : updateFacturaCompraDto.fechaVencimiento,
                observaciones: updateFacturaCompraDto.observaciones,
                subtotal,
                iva: totalIva,
                descuento,
                total
            };

            // ⭐ Si la factura sigue siendo BORRADOR, resetear estados de pago
            if (factura.estado === GastoEstado.BORRADOR) {
              updatePayload.paymentStatus = PaymentStatus.PENDING;
              updatePayload.saldoPendiente = 0;
              updatePayload.totalPagado = 0;
            }

            this.logger.debug(`Actualizando factura ${id} con payload: ${JSON.stringify(updatePayload)}`);

            // update directo (más rápido que save)
            await queryRunner.manager.update(
                FacturaCompra,
                { id },
                updatePayload
            );

            await queryRunner.commitTransaction();
            this.logger.log(`Factura ${id} actualizada exitosamente`);

            return await this.findOne(id);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error actualizando factura ${id}: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al actualizar la factura');
        } finally {
            await queryRunner.release();
        }
    }

    async remove(id: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const factura = await queryRunner.manager.findOne(FacturaCompra, {
                where: { id },
                relations: ['items']
            });

            if (!factura) {
                throw new NotFoundException('Factura no encontrada');
            }

            if (!factura.puedeEliminarse()) {
                throw new BadRequestException('Solo se pueden eliminar facturas en estado borrador');
            }

            // Verificar si tiene pagos
            const pagos = await queryRunner.manager.find(Pago, {
                where: { facturaCompraId: id }
            });

            if (pagos.length > 0) {
                throw new BadRequestException('No se puede eliminar la factura porque tiene pagos asociados');
            }

            await queryRunner.manager.softRemove(factura);
            await queryRunner.manager.softRemove(factura.items);
            

            await queryRunner.commitTransaction();
            this.logger.log(`Factura ${id} eliminada exitosamente`);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error eliminando factura ${id}: ${error.message}`, error.stack);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    private async calcularTotales(queryRunner: QueryRunner, items: CreateFacturaCompraItemDto[]): 
            Promise<{ subtotal: number; totalIva: number; descuento: number, detalles: Partial<FacturaCompraDetalle>[] }> {

        let subtotal = 0;
        let totalIva = 0;
        let descuento = 0;
        const detalles: Partial<FacturaCompraDetalle>[] = [];

        for (const item of items) {
            const articulo = await queryRunner.manager.findOne(Articulo, {
                where: { id: item.articuloId },
                relations: ['categoriaArticulo', 'categoriaArticulo.cuentaPrincipal', 'impuestoRel']
            });

            if (!articulo) throw new NotFoundException(`Producto no encontrado: ${item.articuloId}`);
            if (!articulo.isActive) throw new BadRequestException(`El producto ${articulo.nombre} no está activo`);

            const precioUnitario = Number(item.unitPrice) || 0;
            const cantidad = Number(item.quantity) || 0;
            const porcentajeIva = Number(item.iva) || 0;
            const porcentajeDescuento = Number(item.discount) || 0;

            let impuestoIdSeleccionado: string | undefined;
            if (item.impuestoId) {
                const impuesto = await queryRunner.manager.findOne(Impuesto, {
                    where: { id: item.impuestoId, activo: true }
                });
                if (!impuesto) throw new NotFoundException(`Impuesto ${item.impuestoId} no encontrado`);
                impuestoIdSeleccionado = impuesto.id;
            } else {
                impuestoIdSeleccionado = articulo.impuestoId || undefined;
            }

            const itemSubtotal = MathUtil.mul(precioUnitario, cantidad);
            const valorIva = MathUtil.percentage(itemSubtotal, porcentajeIva);
            const descuentoValor = MathUtil.percentage(itemSubtotal, porcentajeDescuento);
            
            // itemSubtotal + valorIva - descuentoValor
            const itemTotal = MathUtil.sub(MathUtil.sum(itemSubtotal, valorIva), descuentoValor);

            detalles.push({
                articuloId: articulo.id,
                descripcion: item.descripcion || '',
                quantity: cantidad,
                unitPrice: precioUnitario,  
                porcentajeIva: porcentajeIva,
                impuestoId: impuestoIdSeleccionado,
                descuento: porcentajeDescuento,
                valorSubtotal: itemSubtotal,
                valorIva: valorIva,
                valorDescuento: descuentoValor,
                itemTotal: itemTotal
            });

            subtotal = MathUtil.sum(subtotal, itemSubtotal);
            totalIva = MathUtil.sum(totalIva, valorIva);
            descuento = MathUtil.sum(descuento, descuentoValor);
        }

        return { subtotal, totalIva, descuento, detalles };
    }

    async reintentarAsiento(id: string, userId: string): Promise<FacturaCompra> {
        const gasto = await this.findOne(id);

        if (gasto.estado !== GastoEstado.ERROR_ASIENTO) {
            throw new BadRequestException('Solo se pueden reintentar facturas con error en el asiento.');
        }

        try {
            await this.asientosContablesService.generarAsientoGasto(gasto, userId);

            // ✅ FIX: update() selectivo — restaurar estado sin tocar campos financieros
            await this.facturaCompraRepository.update(
                { id },
                { estado: GastoEstado.REGISTRADO, asientoError: null, fechaAsientoError: undefined },
            );

            this.logger.log(`Asiento reintentado exitosamente para factura ${gasto.numero}`);
            return await this.findOne(id);

        } catch (error) {
            await this.facturaCompraRepository.update(
                { id },
                { asientoError: error.message, fechaAsientoError: new Date() },
            );
            this.logger.error(`Fallo reintento de asiento para factura ${gasto.numero}: ${error.message}`);
            throw new BadRequestException(`El asiento sigue fallando: ${error.message}`);
        }
    }
}
