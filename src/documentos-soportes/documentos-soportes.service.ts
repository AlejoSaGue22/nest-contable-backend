import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateDocumentoSoporteDto } from './dto/create-documento-soporte.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DianStatusSoporte, DocumentoSoporte, DocumentoSoporteEstado, TipoDocumentoSoporte } from './entities/documento-soporte.entity';
import { DataSource, QueryRunner, Repository, In } from 'typeorm';
import { Pago } from 'src/pagos/entities/pago.entity';
import { PaymentStatus, MedioPago, AnticipoEstado } from 'src/pagos/enums/pago.enum';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { TipoAsiento } from 'src/asientos-contables/entities/asientos-contable.entity';
import { ContabilizacionEngine } from 'src/asientos-contables/engine/contabilizacion.engine';
import { DocumentoSoporteDetalle } from './entities/documento-soporte-detalle.entity';
import { UpdateDocumentoSoporteDto } from './dto/update-documento-soporte.dto';
import { CreateDocumentoSoporteItemDto } from './dto/create-documento-soporte-item.dto';
import { FormaPago } from 'src/facturas-ventas/enums/factura-venta.enum';
import { DocumentoSoporteFilterDto } from './dto/documento-soporte-filter.dto';
import { MathUtil } from 'src/common/utils/math.util';
import { MetodoPago } from 'src/core/catalogs/entities/metodo-pago.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { PagosService } from 'src/pagos/pagos.service';
import { Anticipo } from 'src/pagos/entities/anticipo.entity';
import { AnticipoAplicacion, AplicacionEstado } from 'src/pagos/entities/anticipo-aplicacion.entity';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { NotaAjusteSoporte } from 'src/notas-ajuste-soporte/entities/nota-ajuste-soporte.entity';
import { TipoNotaCompra, EstadoNotaCompra } from 'src/notas-ajuste-compras/enums/notas-ajuste-compra.enum';
import { AdvertenciaInventario, InventarioService, ResultadoKardex } from 'src/inventario/inventario.service';
import { DocumentoInventario } from 'src/inventario/entities/movimiento-inventario.entity';
import { FactusService } from 'src/api-dian/services/factus.service';


@Injectable()
export class DocumentosSoportesService {
    private readonly logger = new Logger(DocumentosSoportesService.name);

    constructor(
        @InjectRepository(DocumentoSoporte)
        private documentoRepository: Repository<DocumentoSoporte>,

        @InjectRepository(DocumentoSoporteDetalle)
        private itemsDocumentoRepository: Repository<DocumentoSoporteDetalle>,

        @InjectRepository(Proveedor)
        private proveedorRepository: Repository<Proveedor>,

        @InjectRepository(Articulo)
        private articuloRepository: Repository<Articulo>,

        @InjectRepository(Impuesto)
        private impuestoRepository: Repository<Impuesto>,

        @InjectRepository(NotaAjusteSoporte)
        private readonly notaAjusteSoporteRepository: Repository<NotaAjusteSoporte>,

        private dataSource: DataSource,
        private asientosContablesService: AsientosContablesService,
        private contabilizacionEngine: ContabilizacionEngine,
        private pagosService: PagosService,
        private readonly parametrizacionService: ParametrizacionContableService,
        private readonly inventarioService: InventarioService,
        private readonly factusService: FactusService,
    ) { }

    private validarPeriodo(dto: CreateDocumentoSoporteDto | UpdateDocumentoSoporteDto): void {
        const mode = dto.generationMode || '1';
        if (mode === '2') {
            if (!dto.periodStartDate) {
                throw new BadRequestException('El modo acumulado semanal requiere la fecha de adquisición (periodStartDate)');
            }
            const start = new Date(dto.periodStartDate);
            if (Number.isNaN(start.getTime())) {
                throw new BadRequestException('La fecha de adquisición (periodStartDate) no es válida');
            }
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const diffDias = Math.floor((hoy.getTime() - new Date(start.setHours(0, 0, 0, 0)).getTime()) / 86400000);
            if (diffDias < 0 || diffDias > 6) {
                throw new BadRequestException('La fecha de adquisición debe estar entre hoy y los 6 días anteriores (modo acumulado semanal)');
            }
        }
    }

    async create(createDto: CreateDocumentoSoporteDto, userId: string): Promise<DocumentoSoporte> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const tipo = createDto.tipo || TipoDocumentoSoporte.ESTANDAR;
            this.validarPeriodo(createDto);

            const proveedor = await queryRunner.manager.findOne(Proveedor, {
                where: { id: createDto.proveedorId }
            });

            if (!proveedor) {
                throw new NotFoundException('Proveedor no encontrado');
            }

            let subtotal = 0;
            let totalIva = 0;
            let descuento = 0;
            const detalles: Partial<DocumentoSoporteDetalle>[] = [];

            for (const itemDto of createDto.items) {
                let articulo: Articulo | null = null;
                let cuentaContable: CuentaContable | null = null;

                if (itemDto.articuloId) {
                    articulo = await queryRunner.manager.findOne(Articulo, {
                        where: { id: itemDto.articuloId },
                        relations: ['categoriaArticulo', 'categoriaArticulo.cuentaPrincipal', 'impuestoRel']
                    });

                    if (!articulo) {
                        throw new NotFoundException(`Artículo ${itemDto.articuloId} no encontrado`);
                    }

                    if (!articulo.categoriaArticulo?.cuentaPrincipal) {
                        throw new BadRequestException(`El artículo ${articulo.nombre} no tiene cuenta contable principal asignada en su categoría`);
                    }
                } else if (itemDto.cuentaContableId) {
                    cuentaContable = await queryRunner.manager.findOne(CuentaContable, {
                        where: { id: itemDto.cuentaContableId }
                    });

                    if (!cuentaContable) {
                        throw new NotFoundException(`Cuenta contable con ID ${itemDto.cuentaContableId} no encontrada`);
                    }
                } else {
                    throw new BadRequestException('Cada ítem debe tener un artículo o una cuenta contable');
                }

                if (createDto.fechaVencimiento) {
                    const fechaVencimiento = new Date(createDto.fechaVencimiento);
                    if (fechaVencimiento < new Date()) {
                        throw new BadRequestException('La fecha de vencimiento no puede ser menor a la fecha actual');
                    }
                }

                if (createDto.metodoPago) {
                    const metodoPago = await queryRunner.manager.findOne(MetodoPago, {
                        where: { codigo: createDto.metodoPago }
                    });

                    if (!metodoPago) {
                        throw new NotFoundException('Método de pago no encontrado');
                    }

                    createDto.metodoPago = metodoPago.codigo;
                }

                const quantity = Number(itemDto.quantity) || 0;
                if (quantity <= 0) {
                    const label = articulo ? articulo.nombre : (cuentaContable ? cuentaContable.nombre : 'concepto');
                    throw new BadRequestException(`La cantidad del ítem ${label} debe ser mayor a cero`);
                }
                const unitPrice = itemDto.unitPrice || (articulo ? articulo.precio : 0) || 0;
                if (unitPrice <= 0) {
                    const label = articulo ? articulo.nombre : (cuentaContable ? cuentaContable.nombre : 'concepto');
                    throw new BadRequestException(`El precio unitario del ítem ${label} debe ser mayor a cero`);
                }
                const totalSinDescuento = MathUtil.mul(itemDto.quantity, unitPrice);

                const descuentoPorcentaje = itemDto.discount || 0;
                const descuentoValor = MathUtil.percentage(totalSinDescuento, descuentoPorcentaje);

                const itemImporte = MathUtil.sub(totalSinDescuento, descuentoValor);

                const porcentajeIva = itemDto.iva || (articulo ? articulo.porcentajeIva : 0);
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
                    impuestoIdSeleccionado = (articulo ? (articulo.impuestoId || undefined) : undefined);
                }

                const valorIva = MathUtil.percentage(itemImporte, porcentajeIva);
                const itemTotal = MathUtil.sum(itemImporte, valorIva);

                detalles.push({
                    articuloId: articulo ? articulo.id : null,
                    cuentaContableId: cuentaContable ? cuentaContable.id : null,
                    descripcion: itemDto.descripcion || (articulo ? articulo.nombre : (cuentaContable ? `${cuentaContable.codigo} - ${cuentaContable.nombre}` : '')),
                    unitPrice,
                    quantity: itemDto.quantity,
                    porcentajeIva,
                    impuestoId: impuestoIdSeleccionado,
                    valorIva,
                    valorSubtotal: totalSinDescuento,
                    descuento: itemDto.discount || 0,
                    valorDescuento: descuentoValor,
                    itemTotal
                });

                subtotal = MathUtil.sum(subtotal, totalSinDescuento);
                totalIva = MathUtil.sum(totalIva, valorIva);
                descuento = MathUtil.sum(descuento, descuentoValor);
            }

            const total = MathUtil.sum(MathUtil.sub(subtotal, descuento), totalIva);
            const isDraft = createDto.isDraft;
            const numero = isDraft == true ? null : await this.generarNumeroDocumento(queryRunner);

            let paymentStatus: PaymentStatus;
            let saldoPendiente: number;
            let totalPagado: number;

            let montoAnticiposTotal = 0;
            if (createDto.anticiposAsociados && createDto.anticiposAsociados.length > 0) {
                montoAnticiposTotal = createDto.anticiposAsociados.reduce(
                    (acc, curr) => MathUtil.sum(acc, curr.montoAplicado),
                    0,
                );
            }

            if (isDraft == true) {
                paymentStatus = PaymentStatus.PENDING;
                saldoPendiente = 0;
                totalPagado = 0;
            } else {
                totalPagado = montoAnticiposTotal;
                saldoPendiente = MathUtil.sub(total, montoAnticiposTotal);
                paymentStatus = saldoPendiente === 0
                    ? PaymentStatus.PAID
                    : (totalPagado > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING);
            }

            const { items, ...dtoRest } = createDto;

            const documento = queryRunner.manager.create(DocumentoSoporte, {
                ...dtoRest,
                tipo,
                numero: numero || null,
                numeroFacturaProveedor: createDto.numeroFacturaProveedor,
                fecha: createDto.fecha,
                proveedorId: proveedor.id,
                observaciones: createDto.observaciones,
                formaPago: createDto.formaPago,
                metodoPago: createDto.metodoPago || null,
                cuentaBancariaId: createDto.cuentaBancariaId || null,
                fechaVencimiento: createDto.fechaVencimiento?.trim() === '' ? null : createDto.fechaVencimiento,
                generationMode: createDto.generationMode || '1',
                periodStartDate: createDto.periodStartDate || null,
                subtotal,
                iva: totalIva,
                descuento,
                total,
                estado: isDraft == true ? DocumentoSoporteEstado.BORRADOR : DocumentoSoporteEstado.REGISTRADO,
                paymentStatus,
                saldoPendiente,
                totalPagado,
                createdById: userId,
            });

            const documentoGuardado = await queryRunner.manager.save(DocumentoSoporte, documento);

            const itemsToSave = detalles.map(item =>
                queryRunner.manager.create(DocumentoSoporteDetalle, {
                    ...item,
                    documentoSoporteId: documentoGuardado.id
                })
            );
            await queryRunner.manager.save(DocumentoSoporteDetalle, itemsToSave);

            await this.asociarAnticipos(queryRunner, createDto.anticiposAsociados || [], documentoGuardado.id, createDto.fecha, userId, !!isDraft);

            // El documento electrónico NO se contabiliza al crear: solo al emitir (aceptación DIAN).
            // El estándar directo sí contabiliza aquí (igual que la compra directa).
            if (!isDraft && tipo === TipoDocumentoSoporte.ESTANDAR) {
                try {
                    documentoGuardado.items = itemsToSave;
                    documentoGuardado.proveedor = proveedor;
                    if (documentoGuardado.cuentaBancariaId) {
                        const docConRelacion = await queryRunner.manager.findOne(DocumentoSoporte, {
                            where: { id: documentoGuardado.id },
                            relations: ['cuentaBancaria'],
                        });
                        if (docConRelacion) {
                            documentoGuardado.cuentaBancaria = docConRelacion.cuentaBancaria;
                        }
                    }
                    await this.contabilizacionEngine.contabilizarDocumento('DOCUMENTO_SOPORTE', documentoGuardado.id, userId, queryRunner);
                    this.logger.log(`Asiento contable generado para documento soporte ${documentoGuardado.numero}`);

                    await this.generarCrucesAnticipos(queryRunner, documentoGuardado, userId);
                } catch (asientoError) {
                    await queryRunner.manager.update(
                        DocumentoSoporte,
                        { id: documentoGuardado.id },
                        {
                            estado: DocumentoSoporteEstado.ERROR_ASIENTO,
                            asientoError: asientoError.message,
                            fechaAsientoError: new Date()
                        }
                    );

                    this.logger.error(`Error generando asiento para documento soporte ${documentoGuardado.numero}: ${asientoError.message}`);
                }

                await this.pagarContadoAutomatico(queryRunner, documentoGuardado, montoAnticiposTotal, userId);
            }

            await queryRunner.commitTransaction();
            this.logger.log(`Documento soporte creado: ${documentoGuardado.numero}`);

            if (!isDraft) {
                try {
                    const kardex: ResultadoKardex = await this.inventarioService.registrarEntradasDocumentoSoporte(
                        this.dataSource.manager,
                        documentoGuardado.id,
                        (detalles ?? []).map((d) => ({
                            articuloId: d.articuloId,
                            cantidad: Number(d.quantity),
                        })),
                        documentoGuardado.numero || '',
                        userId,
                    );
                    const alertas = InventarioService.alertasNegativo(kardex);
                    if (alertas.length) {
                        (documentoGuardado as any).advertenciasInventario = alertas;
                    }
                } catch (invError) {
                    this.logger.error(`Error kardex documento soporte directo ${documentoGuardado.numero}: ${invError.message}`);
                }
            }

            return documentoGuardado;

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error creando documento soporte: ${error.message}`, error.stack);

            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }

            throw new InternalServerErrorException('Error al crear el documento soporte');
        } finally {
            await queryRunner.release();
        }
    }

    async findAll(options: DocumentoSoporteFilterDto): Promise<{ data: DocumentoSoporte[], meta: any }> {
        try {
            const { page = 1, limit = 10, ...where } = options;
            const skip = (page < 1 ? 0 : (page - 1)) * limit;

            const queryBuilder = this.documentoRepository
                .createQueryBuilder('documento')
                .leftJoinAndSelect('documento.proveedor', 'proveedor')
                .leftJoinAndSelect('documento.items', 'items')
                .leftJoinAndSelect('items.articulo', 'articulo')
                .leftJoinAndSelect('documento.createdBy', 'createdBy')
                .leftJoinAndSelect('documento.cuentaBancaria', 'cuentaBancaria')
                .where('1=1');

            if (where.estado) {
                queryBuilder.andWhere('documento.estado = :estado', { estado: where.estado });
            }

            if (where.tipo) {
                queryBuilder.andWhere('documento.tipo = :tipo', { tipo: where.tipo });
            }

            if (where.dianStatus) {
                queryBuilder.andWhere('documento.dianStatus = :dianStatus', { dianStatus: where.dianStatus });
            }

            if (where.paymentStatus) {
                queryBuilder.andWhere('documento.paymentStatus = :paymentStatus', { paymentStatus: where.paymentStatus });
            }

            if (where.providerName) {
                queryBuilder.andWhere('(proveedor.razonSocial ILIKE :providerName OR proveedor.nombre ILIKE :providerName OR proveedor.identificacion ILIKE :providerName)', {
                    providerName: `%${where.providerName}%`
                });
            }

            if (where.numeroFactura) {
                queryBuilder.andWhere('(documento.numero = :numeroFactura OR documento.numeroDian = :numeroFactura OR documento.numeroFacturaProveedor = :numeroFactura)', { numeroFactura: where.numeroFactura });
            }

            if (where.startDate && where.endDate) {
                queryBuilder.andWhere('documento.createdAt BETWEEN :startDate AND :endDate', {
                    startDate: where.startDate,
                    endDate: where.endDate,
                });
            }

            queryBuilder
                .orderBy('documento.createdAt', 'DESC')
                .skip(skip)
                .take(limit);

            const [data, total] = await queryBuilder.getManyAndCount();

            await this.anexarResumenNotas(data);

            const meta = {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            };

            return { data, meta };

        } catch (error) {
            this.logger.error(`Error obteniendo documentos soporte: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener los documentos soporte');
        }
    }

    async getNotasResumen(documentoId: string) {
        const documento = await this.documentoRepository.findOne({ where: { id: documentoId } });
        if (!documento) {
            throw new NotFoundException(`Documento soporte ${documentoId} no encontrado`);
        }

        const notas = await this.notaAjusteSoporteRepository.find({
            where: { documentoOriginalId: documentoId },
            order: { fecha: 'DESC', createdAt: 'DESC' },
        });

        const afecta = (estado: EstadoNotaCompra) =>
            estado === EstadoNotaCompra.REGISTERED || estado === EstadoNotaCompra.ERROR_ASIENTO;

        let totalNCAplicado = 0;
        let totalNDAplicado = 0;
        let countNC = 0;
        let countND = 0;
        let countBorrador = 0;

        const items = notas.map((n) => {
            const afectaSaldo = afecta(n.estado);
            const aplicado = afectaSaldo
                ? (n.saldoAplicado ? Number(n.valorAplicadoCartera ?? 0) : Number(n.total))
                : 0;
            if (n.tipo === TipoNotaCompra.CREDITO) {
                countNC++;
                if (afectaSaldo) totalNCAplicado += aplicado;
            } else {
                countND++;
                if (afectaSaldo) totalNDAplicado += aplicado;
            }
            if (n.estado === EstadoNotaCompra.DRAFT) countBorrador++;
            return {
                id: n.id,
                tipo: n.tipo,
                numeroCompleto: n.numeroCompleto,
                fecha: n.fecha,
                motivo: n.motivo,
                total: Number(n.total),
                estado: n.estado,
                afectaSaldo,
                valorAplicado: Math.round(aplicado * 100) / 100,
                esReembolsoAbono: n.esReembolsoAbono ?? false,
            };
        });

        const total = Number(documento.total);
        const round2 = (v: number) => Math.round(v * 100) / 100;
        return {
            documentoId,
            totalFactura: total,
            totalNCAplicado: round2(totalNCAplicado),
            totalNDAplicado: round2(totalNDAplicado),
            netoExigible: round2(total - totalNCAplicado + totalNDAplicado),
            tieneNota: notas.length > 0,
            countNC,
            countND,
            countBorrador,
            items,
        };
    }

    private async anexarResumenNotas(documentos: DocumentoSoporte[]): Promise<void> {
        if (!documentos || documentos.length === 0) return;
        const ids = documentos.map((f) => f.id);
        const rows: Array<{ documentoId: string; total: string; aplicadas: string; aplicadasND: string; countNC: string; countND: string }> =
            await this.notaAjusteSoporteRepository
                .createQueryBuilder('nota')
                .select('nota.documentoOriginalId', 'documentoId')
                .addSelect('COUNT(*)', 'total')
                .addSelect(
                    `SUM(CASE WHEN nota.tipo = '${TipoNotaCompra.CREDITO}' AND nota.estado IN ('${EstadoNotaCompra.REGISTERED}', '${EstadoNotaCompra.ERROR_ASIENTO}') THEN COALESCE(CASE WHEN nota."saldoAplicado" THEN nota."valorAplicadoCartera" ELSE nota.total END, 0) ELSE 0 END)`,
                    'aplicadas',
                )
                .addSelect(
                    `SUM(CASE WHEN nota.tipo = '${TipoNotaCompra.DEBITO}' AND nota.estado IN ('${EstadoNotaCompra.REGISTERED}', '${EstadoNotaCompra.ERROR_ASIENTO}') THEN COALESCE(CASE WHEN nota."saldoAplicado" THEN nota."valorAplicadoCartera" ELSE nota.total END, 0) ELSE 0 END)`,
                    'aplicadasND',
                )
                .addSelect(`SUM(CASE WHEN nota.tipo = '${TipoNotaCompra.CREDITO}' THEN 1 ELSE 0 END)`, 'countNC')
                .addSelect(`SUM(CASE WHEN nota.tipo = '${TipoNotaCompra.DEBITO}' THEN 1 ELSE 0 END)`, 'countND')
                .where('nota.documentoOriginalId IN (:...ids)', { ids })
                .groupBy('nota.documentoOriginalId')
                .getRawMany();

        const map = new Map(rows.map((r) => [r.documentoId, r]));
        for (const f of documentos) {
            const r = map.get(f.id);
            (f as any).notasResumen = r
                ? {
                    tieneNota: true,
                    totalNCAplicado: Number(r.aplicadas ?? 0),
                    totalNDAplicado: Number(r.aplicadasND ?? 0),
                    countNC: Number(r.countNC ?? 0),
                    countND: Number(r.countND ?? 0),
                }
                : { tieneNota: false, totalNCAplicado: 0, totalNDAplicado: 0, countNC: 0, countND: 0 };
        }
    }

    async findOne(id: string): Promise<DocumentoSoporte> {
        try {
            const documento = await this.documentoRepository.findOne({
                where: { id },
                relations: ['proveedor', 'proveedor.ciudadRel', 'items', 'items.articulo', 'items.impuestoRel', 'metodoPagoRel', 'createdBy', 'cuentaBancaria']
            });

            if (!documento) {
                throw new NotFoundException(`Documento soporte ${id} no encontrado`);
            }

            return documento;

        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error(`Error obteniendo documento soporte: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al obtener el documento soporte');
        }
    }

    /**
     * Registrar un documento ESTÁNDAR en borrador (contabiliza local, sin DIAN).
     * Los electrónicos se emiten con emitir(), nunca con registrar().
     */
    async registrar(id: string, userId: string): Promise<DocumentoSoporte> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const documento = await queryRunner.manager.findOne(DocumentoSoporte, {
                where: { id },
                relations: ['items', 'items.articulo', 'proveedor']
            });

            if (!documento) {
                throw new NotFoundException(`Documento soporte ${id} no encontrado`);
            }

            if (documento.estado !== DocumentoSoporteEstado.BORRADOR) {
                throw new BadRequestException('Solo se pueden registrar documentos en estado borrador');
            }

            if (documento.tipo === TipoDocumentoSoporte.ELECTRONICO) {
                throw new BadRequestException('El documento electrónico debe emitirse a la DIAN con la acción Emitir, no con Registrar');
            }

            const numero = await this.generarNumeroDocumento(queryRunner);
            const aplicacionesBorrador = await queryRunner.manager.find(AnticipoAplicacion, {
                where: { documentoSoporteId: id, estado: AplicacionEstado.BORRADOR },
            });

            let montoAnticiposTotal = 0;
            for (const app of aplicacionesBorrador) {
                const anticipo = await queryRunner.manager.findOne(Anticipo, {
                    where: { id: app.anticipoId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!anticipo) {
                    throw new NotFoundException(`Anticipo con ID ${app.anticipoId} no encontrado`);
                }
                if (anticipo.saldoDisponible < app.montoAplicado) {
                    throw new BadRequestException(`El anticipo ${anticipo.numero} ya no cuenta con saldo disponible suficiente.`);
                }

                anticipo.saldoDisponible = MathUtil.sub(anticipo.saldoDisponible, app.montoAplicado);
                anticipo.estado = anticipo.saldoDisponible === 0 ? AnticipoEstado.APLICADO : AnticipoEstado.PARCIAL;
                await queryRunner.manager.save(Anticipo, anticipo);

                app.estado = AplicacionEstado.ACTIVO;
                await queryRunner.manager.save(AnticipoAplicacion, app);

                montoAnticiposTotal = MathUtil.sum(montoAnticiposTotal, app.montoAplicado);
            }

            const totalPagado = montoAnticiposTotal;
            const saldoPendiente = MathUtil.sub(documento.total, totalPagado);
            const paymentStatus = saldoPendiente === 0
                ? PaymentStatus.PAID
                : (totalPagado > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING);

            await queryRunner.manager.update(
                DocumentoSoporte,
                { id },
                {
                    numero,
                    estado: DocumentoSoporteEstado.REGISTRADO,
                    paymentStatus,
                    saldoPendiente,
                    totalPagado
                },
            );

            const documentoActualizado = await queryRunner.manager.findOne(DocumentoSoporte, {
                where: { id },
                relations: ['items', 'items.articulo', 'proveedor']
            });

            {
                await this.contabilizacionEngine.contabilizarDocumento('DOCUMENTO_SOPORTE', documentoActualizado!.id, userId, queryRunner);
                await this.generarCrucesAnticipos(queryRunner, documentoActualizado!, userId);
            }

            if (documento.formaPago === FormaPago.CONTADO) {
                await this.pagarContadoEnTransaccion(queryRunner, documento, numero, montoAnticiposTotal, userId);
            }

            await queryRunner.commitTransaction();
            this.logger.log(`Documento soporte ${numero} registrado correctamente (asiento + pago)`);

            let advertenciasRegistro: AdvertenciaInventario[] = [];
            try {
                const kardex: ResultadoKardex = await this.inventarioService.registrarEntradasDocumentoSoporte(
                    this.dataSource.manager,
                    id,
                    (documentoActualizado!.items ?? []).map((it) => ({
                        articuloId: it.articuloId,
                        cantidad: Number(it.quantity),
                    })),
                    numero,
                    userId,
                );
                advertenciasRegistro = InventarioService.alertasNegativo(kardex);
            } catch (invError) {
                this.logger.error(`Error kardex documento soporte ${numero}: ${invError.message}`);
            }

            const registrado = await this.findOne(id);
            if (advertenciasRegistro.length) {
                (registrado as any).advertenciasInventario = advertenciasRegistro;
            }
            return registrado;

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error registrando documento soporte ${id}: ${error.message}`, error.stack);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Emitir un documento ELECTRÓNICO en borrador a Factus/DIAN.
     * Aceptado → persiste número DIAN + snapshot y contabiliza (asiento + cruces + pago contado + kardex).
     * Rechazado → vuelve a borrador con el error. 409 pendiente → elimina en Factus y reintenta una vez.
     */
    async emitir(id: string, userId: string): Promise<DocumentoSoporte> {
        const documento = await this.findOne(id);

        if (!documento.puedeEmitirse()) {
            throw new BadRequestException('Solo se pueden emitir documentos electrónicos en estado borrador');
        }
        this.logger.log(`Emitiendo documento soporte electrónico: ${documento.numeroFacturaProveedor}`);

        const referenceCode = documento.referenceCode || await this.generarReferenceCode();

        await this.documentoRepository.update(
            { id },
            {
                referenceCode,
                dianStatus: DianStatusSoporte.SENT,
                fechaEnvioDIAN: new Date(),
                intentosEnvio: (documento.intentosEnvio ?? 0) + 1,
            },
        );

        const documentoParaEnvio = await this.findOne(id);

        const enviar = () => this.factusService.crearYValidarDocumentoSoporte(documentoParaEnvio, referenceCode);

        try {
            let respuesta = await enviar().catch(async (factusError) => {
                // 409: pendiente sin validar en Factus → eliminar y reintentar una sola vez.
                if (/pendiente/i.test(factusError?.message || '')) {
                    this.logger.warn(`DSE ${referenceCode} pendiente en Factus: eliminando para reenviar…`);
                    await this.factusService.eliminarDocumentoSoporteNoValidado(referenceCode);
                    return enviar();
                }
                throw factusError;
            });

            if (respuesta.estado === 'aceptada') {
                return await this.aplicarAceptacionDian(id, userId, respuesta);
            }

            await this.documentoRepository.update(
                { id },
                {
                    dianStatus: DianStatusSoporte.REJECTED,
                    mensajeError: respuesta.mensaje || '',
                    dianResponse: respuesta.respuestaCompleta,
                },
            );
            this.logger.error(`❌ Documento soporte RECHAZADO por DIAN: ${respuesta.mensaje}`);
            return await this.findOne(id);
        } catch (error) {
            await this.documentoRepository.update(
                { id },
                {
                    dianStatus: DianStatusSoporte.PENDING,
                    mensajeError: error.message,
                },
            );
            this.logger.error(`Error emitiendo documento soporte: ${error.message}`);
            throw new InternalServerErrorException(`Error al emitir documento soporte electrónico: ${error.message}`);
        }
    }

    private async aplicarAceptacionDian(id: string, userId: string, respuesta: any): Promise<DocumentoSoporte> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const documento = await queryRunner.manager.findOne(DocumentoSoporte, {
                where: { id },
                relations: ['items', 'items.articulo', 'proveedor'],
            });
            if (!documento) throw new NotFoundException(`Documento soporte ${id} no encontrado`);

            const numero = await this.generarNumeroDocumento(queryRunner);

            const aplicacionesBorrador = await queryRunner.manager.find(AnticipoAplicacion, {
                where: { documentoSoporteId: id, estado: AplicacionEstado.BORRADOR },
            });

            let montoAnticiposTotal = 0;
            for (const app of aplicacionesBorrador) {
                const anticipo = await queryRunner.manager.findOne(Anticipo, {
                    where: { id: app.anticipoId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!anticipo) {
                    throw new NotFoundException(`Anticipo con ID ${app.anticipoId} no encontrado`);
                }
                if (anticipo.saldoDisponible < app.montoAplicado) {
                    throw new BadRequestException(`El anticipo ${anticipo.numero} ya no cuenta con saldo disponible suficiente.`);
                }

                anticipo.saldoDisponible = MathUtil.sub(anticipo.saldoDisponible, app.montoAplicado);
                anticipo.estado = anticipo.saldoDisponible === 0 ? AnticipoEstado.APLICADO : AnticipoEstado.PARCIAL;
                await queryRunner.manager.save(Anticipo, anticipo);

                app.estado = AplicacionEstado.ACTIVO;
                await queryRunner.manager.save(AnticipoAplicacion, app);

                montoAnticiposTotal = MathUtil.sum(montoAnticiposTotal, app.montoAplicado);
            }

            const totalPagado = montoAnticiposTotal;
            const saldoPendiente = MathUtil.sub(Number(documento.total), totalPagado);
            const paymentStatus = saldoPendiente === 0
                ? PaymentStatus.PAID
                : (totalPagado > 0 ? PaymentStatus.PARTIAL : PaymentStatus.PENDING);

            await queryRunner.manager.update(DocumentoSoporte, { id }, {
                numero,
                estado: DocumentoSoporteEstado.REGISTRADO,
                dianStatus: DianStatusSoporte.ACCEPTED,
                fechaAceptacionDIAN: new Date(),
                numeroDian: respuesta.numeroDian,
                cuds: respuesta.cuds || null,
                qrCode: respuesta.qrCode || null,
                qrImageBase64: respuesta.qrImageBase64 || null,
                publicUrl: respuesta.publicUrl || null,
                xmlUrl: respuesta.xmlUrl || null,
                pdfUrl: respuesta.pdfUrl || null,
                dianResponse: respuesta.respuestaCompleta,
                factusNumberingRangeId: respuesta.numberingRangeId ?? null,
                factusResolutionNumber: respuesta.resolutionNumber ?? null,
                factusRangePrefix: respuesta.rangePrefix ?? null,
                paymentStatus,
                saldoPendiente,
                totalPagado,
            });

            const documentoActualizado = await queryRunner.manager.findOne(DocumentoSoporte, {
                where: { id },
                relations: ['items', 'items.articulo', 'proveedor'],
            });

            try {
                await this.contabilizacionEngine.contabilizarDocumento('DOCUMENTO_SOPORTE', documentoActualizado!.id, userId, queryRunner);
                await this.generarCrucesAnticipos(queryRunner, documentoActualizado!, userId);
            } catch (asientoError) {
                await queryRunner.manager.update(DocumentoSoporte, { id }, {
                    estado: DocumentoSoporteEstado.ERROR_ASIENTO,
                    asientoError: asientoError.message,
                    fechaAsientoError: new Date(),
                });
                this.logger.error(`Error generando asientos para DSE ${respuesta.numeroDian}: ${asientoError.message}`);
            }

            if (documento.formaPago === FormaPago.CONTADO) {
                await this.pagarContadoEnTransaccion(queryRunner, documento, numero, montoAnticiposTotal, userId);
            }

            await queryRunner.commitTransaction();
            this.logger.log(`✅ Documento soporte ACEPTADO por DIAN: ${respuesta.numeroDian}`);

            try {
                const kardex: ResultadoKardex = await this.inventarioService.registrarEntradasDocumentoSoporte(
                    this.dataSource.manager,
                    id,
                    (documentoActualizado!.items ?? []).map((it) => ({
                        articuloId: it.articuloId,
                        cantidad: Number(it.quantity),
                    })),
                    numero,
                    userId,
                );
                const aceptado = await this.findOne(id);
                const alertas = InventarioService.alertasNegativo(kardex);
                if (alertas.length) (aceptado as any).advertenciasInventario = alertas;
                return aceptado;
            } catch (invError) {
                this.logger.error(`Error kardex DSE ${numero}: ${invError.message}`);
            }

            return await this.findOne(id);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async anular(id: string, userId: string): Promise<DocumentoSoporte> {
        const documento = await this.findOne(id);

        if (documento.estado === DocumentoSoporteEstado.ANULADO) {
            throw new BadRequestException('El documento soporte ya está anulado');
        }

        if (documento.estaValidado()) {
            throw new BadRequestException('No se puede anular un documento soporte validado por la DIAN. Debe emitir una nota de ajuste.');
        }

        if (documento.paymentStatus === PaymentStatus.PARTIAL || documento.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException(
                'No se puede anular un documento soporte pagado o con pagos registrados.'
            );
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const aplicaciones = await queryRunner.manager.find(AnticipoAplicacion, {
                where: { documentoSoporteId: id, estado: AplicacionEstado.ACTIVO }
            });

            for (const app of aplicaciones) {
                const anticipo = await queryRunner.manager.findOne(Anticipo, {
                    where: { id: app.anticipoId },
                    lock: { mode: 'pessimistic_write' }
                });
                if (anticipo) {
                    const nuevoSaldo = MathUtil.sum(anticipo.saldoDisponible, app.montoAplicado);
                    const nuevoEstado = nuevoSaldo === anticipo.montoOriginal ? AnticipoEstado.PENDIENTE : AnticipoEstado.PARCIAL;

                    await queryRunner.manager.update(Anticipo, { id: anticipo.id }, {
                        saldoDisponible: nuevoSaldo,
                        estado: nuevoEstado
                    });
                }
                await queryRunner.manager.update(AnticipoAplicacion, { id: app.id }, {
                    estado: AplicacionEstado.REVERTIDO
                });
            }

            await queryRunner.manager.update(
                AnticipoAplicacion,
                { documentoSoporteId: id, estado: AplicacionEstado.BORRADOR },
                { estado: AplicacionEstado.REVERTIDO }
            );

            await queryRunner.manager.update(
                DocumentoSoporte,
                { id },
                { estado: DocumentoSoporteEstado.ANULADO, paymentStatus: PaymentStatus.CANCELLED },
            );

            await queryRunner.commitTransaction();

            const documentoAnulado = await this.findOne(id);

            try {
                await this.asientosContablesService.generarAsientoAnulacionFacturaCompra(documentoAnulado, userId);
                this.logger.log(`Asiento de anulación generado para documento soporte ${documentoAnulado.numero}`);

                if (aplicaciones.length > 0) {
                    const qrAnulacionCruce = this.dataSource.createQueryRunner();
                    await qrAnulacionCruce.connect();
                    await qrAnulacionCruce.startTransaction();
                    try {
                        for (const app of aplicaciones) {
                            if (app.asientoId) {
                                await this.asientosContablesService.anularAsiento(
                                    app.asientoId,
                                    TipoAsiento.ANULACION_COMPROBANTE,
                                    userId,
                                    qrAnulacionCruce,
                                );
                            }
                        }
                        await qrAnulacionCruce.commitTransaction();
                    } catch (cruceAnulacionError) {
                        await qrAnulacionCruce.rollbackTransaction();
                        this.logger.error(`Error anulando asientos de cruce: ${cruceAnulacionError.message}`);
                        throw cruceAnulacionError;
                    } finally {
                        await qrAnulacionCruce.release();
                    }
                }
            } catch (asientoError) {
                await this.documentoRepository.update(
                    { id },
                    {
                        estado: DocumentoSoporteEstado.ERROR_ASIENTO,
                        asientoError: asientoError.message,
                        fechaAsientoError: new Date(),
                    },
                );
                this.logger.error(`Error generando asientos de anulación: ${asientoError.message}`);
            }

            let advertenciasAnulacion: AdvertenciaInventario[] = [];
            try {
                const kardex: ResultadoKardex = await this.inventarioService.revertirDocumento(
                    this.dataSource.manager,
                    DocumentoInventario.DOCUMENTO_SOPORTE,
                    id,
                    `Anulación documento soporte ${documentoAnulado.numero}`,
                    userId,
                );
                advertenciasAnulacion = InventarioService.alertasNegativo(kardex);
            } catch (invError) {
                this.logger.error(`Error kardex anulación documento soporte: ${invError.message}`);
            }

            const anulado = await this.findOne(id);
            if (advertenciasAnulacion.length) {
                (anulado as any).advertenciasInventario = advertenciasAnulacion;
            }
            return anulado;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error anulando documento soporte ${id}: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al anular documento soporte');
        } finally {
            await queryRunner.release();
        }
    }

    async update(id: string, updateDto: UpdateDocumentoSoporteDto): Promise<DocumentoSoporte> {
        if (updateDto.items && updateDto.items.length === 0) {
            throw new BadRequestException('El documento debe tener al menos un item');
        }

        if (updateDto.fechaVencimiento) {
            const fechaVencimiento = new Date(updateDto.fechaVencimiento);
            if (fechaVencimiento < new Date()) {
                throw new BadRequestException('La fecha de vencimiento no puede ser menor a la fecha actual');
            }
        }

        if (updateDto.generationMode || updateDto.periodStartDate) {
            this.validarPeriodo(updateDto);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const documento = await queryRunner.manager.findOne(DocumentoSoporte, {
                where: { id },
                relations: ['items', 'items.articulo']
            });

            if (!documento) {
                throw new NotFoundException(`Documento soporte ${id} no encontrado`);
            }

            if (!documento.puedeEditarse()) {
                throw new BadRequestException('El documento soporte no se puede editar');
            }

            let subtotal = 0;
            let totalIva = 0;
            let descuento = 0;
            let total = 0;

            if (updateDto.items && updateDto.items.length > 0) {
                const calc = await this.calcularTotales(queryRunner, updateDto.items);

                subtotal = calc.subtotal;
                totalIva = calc.totalIva;
                descuento = calc.descuento;
                total = MathUtil.sum(MathUtil.sub(subtotal, descuento), totalIva);

                await queryRunner.manager.delete(DocumentoSoporteDetalle, { documentoSoporteId: id });

                const itemsToSave = calc.detalles.map(item =>
                    queryRunner.manager.create(DocumentoSoporteDetalle, {
                        ...item,
                        documentoSoporteId: documento.id
                    })
                );

                await queryRunner.manager.save(DocumentoSoporteDetalle, itemsToSave);
            }

            const updatePayload: any = {
                proveedorId: updateDto.proveedorId,
                fecha: updateDto.fecha,
                formaPago: updateDto.formaPago,
                metodoPago: updateDto.metodoPago || null,
                cuentaBancariaId: updateDto.cuentaBancariaId || null,
                fechaVencimiento: updateDto.fechaVencimiento?.trim() === '' ? null : updateDto.fechaVencimiento,
                observaciones: updateDto.observaciones,
                generationMode: updateDto.generationMode,
                periodStartDate: updateDto.periodStartDate,
                subtotal,
                iva: totalIva,
                descuento,
                total
            };

            if (documento.estado === DocumentoSoporteEstado.BORRADOR) {
                updatePayload.paymentStatus = PaymentStatus.PENDING;
                updatePayload.saldoPendiente = 0;
                updatePayload.totalPagado = 0;

                if (updateDto.anticiposAsociados) {
                    await queryRunner.manager.delete(AnticipoAplicacion, { documentoSoporteId: id });
                    for (const assoc of updateDto.anticiposAsociados) {
                        const aplicacion = queryRunner.manager.create(AnticipoAplicacion, {
                            anticipoId: assoc.anticipoId,
                            documentoSoporteId: id,
                            montoAplicado: assoc.montoAplicado,
                            fecha: new Date(updateDto.fecha || documento.fecha),
                            estado: AplicacionEstado.BORRADOR,
                            creadoPorId: documento.createdById
                        });
                        await queryRunner.manager.save(AnticipoAplicacion, aplicacion);
                    }
                }
            }

            await queryRunner.manager.update(DocumentoSoporte, { id }, updatePayload);

            await queryRunner.commitTransaction();
            this.logger.log(`Documento soporte ${id} actualizado exitosamente`);

            return await this.findOne(id);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error actualizando documento soporte ${id}: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Error al actualizar el documento soporte');
        } finally {
            await queryRunner.release();
        }
    }

    async remove(id: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const documento = await queryRunner.manager.findOne(DocumentoSoporte, {
                where: { id },
                relations: ['items']
            });

            if (!documento) {
                throw new NotFoundException('Documento soporte no encontrado');
            }

            if (!documento.puedeEliminarse()) {
                throw new BadRequestException('Solo se pueden eliminar documentos en estado borrador');
            }

            const pagos = await queryRunner.manager.find(Pago, {
                where: { documentoSoporteId: id }
            });

            if (pagos.length > 0) {
                throw new BadRequestException('No se puede eliminar el documento porque tiene pagos asociados');
            }

            await queryRunner.manager.softRemove(documento);
            await queryRunner.manager.softRemove(documento.items);

            await queryRunner.commitTransaction();
            this.logger.log(`Documento soporte ${id} eliminado exitosamente`);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error eliminando documento soporte ${id}: ${error.message}`, error.stack);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async reintentarAsiento(id: string, userId: string): Promise<DocumentoSoporte> {
        const documento = await this.findOne(id);

        if (documento.estado !== DocumentoSoporteEstado.ERROR_ASIENTO) {
            throw new BadRequestException('Solo se pueden reintentar documentos con error en el asiento.');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            await this.contabilizacionEngine.contabilizarDocumento('DOCUMENTO_SOPORTE', documento.id, userId, queryRunner);
            await this.generarCrucesAnticipos(queryRunner, documento, userId);

            await queryRunner.manager.update(
                DocumentoSoporte,
                { id },
                { estado: DocumentoSoporteEstado.REGISTRADO, asientoError: null, fechaAsientoError: undefined },
            );

            await queryRunner.commitTransaction();
            this.logger.log(`Asiento reintentado exitosamente para documento soporte ${documento.numero}`);
            return await this.findOne(id);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            await this.documentoRepository.update(
                { id },
                { estado: DocumentoSoporteEstado.ERROR_ASIENTO, asientoError: error.message, fechaAsientoError: new Date() },
            );
            this.logger.error(`Fallo reintento de asiento para documento soporte ${documento.numero}: ${error.message}`);
            throw new BadRequestException(`El asiento sigue fallando: ${error.message}`);
        } finally {
            await queryRunner.release();
        }
    }

    async descargarPdf(id: string): Promise<{ buffer: Buffer; fileName: string }> {
        const documento = await this.findOne(id);
        if (documento.tipo !== TipoDocumentoSoporte.ELECTRONICO || !documento.numeroDian) {
            throw new BadRequestException('Solo los documentos electrónicos aceptados tienen PDF en Factus');
        }
        return this.factusService.descargarPDFDocumentoSoporte(documento.numeroDian);
    }

    // ── Privados ──

    private async asociarAnticipos(
        queryRunner: QueryRunner,
        anticipos: Array<{ anticipoId: string; montoAplicado: number }>,
        documentoId: string,
        fecha: string,
        userId: string,
        isDraft: boolean,
    ): Promise<void> {
        for (const assoc of anticipos) {
            if (isDraft) {
                const aplicacion = queryRunner.manager.create(AnticipoAplicacion, {
                    anticipoId: assoc.anticipoId,
                    documentoSoporteId: documentoId,
                    montoAplicado: assoc.montoAplicado,
                    fecha: new Date(fecha),
                    estado: AplicacionEstado.BORRADOR,
                    creadoPorId: userId
                });
                await queryRunner.manager.save(AnticipoAplicacion, aplicacion);
            } else {
                const anticipo = await queryRunner.manager.findOne(Anticipo, {
                    where: { id: assoc.anticipoId },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!anticipo) {
                    throw new NotFoundException(`Anticipo con ID ${assoc.anticipoId} no encontrado`);
                }
                if (anticipo.saldoDisponible < assoc.montoAplicado) {
                    throw new BadRequestException(`El anticipo ${anticipo.numero} ya no cuenta con saldo disponible suficiente. Saldo actual: $${anticipo.saldoDisponible}, requerido: $${assoc.montoAplicado}`);
                }

                anticipo.saldoDisponible = MathUtil.sub(anticipo.saldoDisponible, assoc.montoAplicado);
                anticipo.estado = anticipo.saldoDisponible === 0 ? AnticipoEstado.APLICADO : AnticipoEstado.PARCIAL;
                await queryRunner.manager.save(Anticipo, anticipo);

                const aplicacion = queryRunner.manager.create(AnticipoAplicacion, {
                    anticipoId: assoc.anticipoId,
                    documentoSoporteId: documentoId,
                    montoAplicado: assoc.montoAplicado,
                    fecha: new Date(fecha),
                    estado: AplicacionEstado.ACTIVO,
                    creadoPorId: userId
                });
                await queryRunner.manager.save(AnticipoAplicacion, aplicacion);
            }
        }
    }

    private async generarCrucesAnticipos(queryRunner: QueryRunner, documento: DocumentoSoporte, userId: string): Promise<void> {
        const aplicacionesActivas = await queryRunner.manager.find(AnticipoAplicacion, {
            where: { documentoSoporteId: documento.id, estado: AplicacionEstado.ACTIVO },
            relations: ['anticipo'],
        });

        if (aplicacionesActivas.length === 0) return;

        const proveedorConCuenta = await queryRunner.manager.findOne(Proveedor, {
            where: { id: documento.proveedorId },
            relations: ['cuentaContable'],
        });

        const config = await this.parametrizacionService.getConfiguracion();
        let cuentaTerceroDefaultId = config?.cuentaPagarProveedoresId;
        let defaultCodigo = '2205';

        const items = documento.items ?? await queryRunner.manager.find(DocumentoSoporteDetalle, {
            where: { documentoSoporteId: documento.id },
        });
        if (items.length > 0) {
            const articulos = await queryRunner.manager.find(Articulo, {
                where: { id: In(items.map(i => i.articuloId).filter(Boolean) as string[]) },
                relations: ['categoriaArticulo', 'categoriaArticulo.cuentaPrincipal'],
            });
            if (articulos.some(a => a.categoriaArticulo?.cuentaPrincipal?.codigo?.startsWith('5'))) {
                cuentaTerceroDefaultId = (config as any)?.cuentaPagarGastosId;
                defaultCodigo = '2335';
            }
        }

        if (!cuentaTerceroDefaultId) {
            cuentaTerceroDefaultId = (await this.asientosContablesService.obtenerCuentaPorCodigo(defaultCodigo)).id;
        }

        const cuentaTerceroId = proveedorConCuenta?.cuentaContable?.id ||
            proveedorConCuenta?.cuentaContableId ||
            cuentaTerceroDefaultId;

        const referencia = documento.numero || documento.numeroDian || '';

        for (const app of aplicacionesActivas) {
            const anticipo = app.anticipo;
            const cuentaAnticipoId = anticipo.cuentaContableId ||
                (await this.asientosContablesService.obtenerCuentaPorCodigo('133005')).id;

            const asientoCruce = await this.asientosContablesService.generarAsientoCruceAnticipo(
                {
                    tipo: 'compra',
                    cuentaTerceroId,
                    cuentaAnticipoId,
                    monto: app.montoAplicado,
                    fecha: this.toDate(documento.fecha),
                    referencia,
                    descripcion: `Cruce automático de anticipo ${anticipo.numero} en Documento soporte ${referencia}`,
                    terceroId: documento.proveedorId,
                    userId,
                },
                queryRunner,
            );

            app.asientoId = asientoCruce.id;
            await queryRunner.manager.save(AnticipoAplicacion, app);
            this.logger.log(`Asiento de cruce de anticipo (${anticipo.numero}) generado para documento soporte ${referencia}`);
        }
    }

    private async pagarContadoEnTransaccion(
        queryRunner: QueryRunner,
        documento: DocumentoSoporte,
        numero: string,
        montoAnticiposTotal: number,
        userId: string,
    ): Promise<void> {
        const pagoMonto = MathUtil.sub(Number(documento.total), montoAnticiposTotal);
        if (pagoMonto <= 0) return;
        const medioPago = documento.metodoPago === '47' || documento.metodoPago === '42'
            ? MedioPago.BANCO
            : MedioPago.CAJA;

        await this.pagosService.registrarPagoDocumentoSoporte(
            documento.id,
            {
                monto: pagoMonto,
                fecha: this.toISOString(documento.fecha),
                medioPago,
                cuentaBancariaId: documento.cuentaBancariaId || undefined,
                referencia: `Pago automático contado - Documento soporte ${numero}`,
                notas: 'Pago generado de forma automática al registrar documento soporte de contado.',
            },
            userId,
            queryRunner,
        );
    }

    private async pagarContadoAutomatico(
        queryRunner: QueryRunner,
        documento: DocumentoSoporte,
        montoAnticiposTotal: number,
        userId: string,
    ): Promise<void> {
        if (documento.formaPago !== FormaPago.CONTADO) return;
        await this.pagarContadoEnTransaccion(queryRunner, documento, documento.numero || '', montoAnticiposTotal, userId);
    }

    private toDate(value: Date | string | null | undefined, fallback: Date = new Date()): Date {
        if (!value) return fallback;
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? fallback : date;
    }

    private toISOString(value: Date | string | null | undefined): string {
        return this.toDate(value).toISOString();
    }

    private async generarNumeroDocumento(queryRunner: QueryRunner): Promise<string> {
        const ultimo = await queryRunner.manager.createQueryBuilder(DocumentoSoporte, 'doc')
            .where('doc.numero IS NOT NULL')
            .orderBy('doc.numero', 'DESC')
            .getOne();

        const ultimoNumero = ultimo?.numero ? parseInt(ultimo.numero.split('-')[1]) : 0;
        return `DS-${(ultimoNumero + 1).toString().padStart(6, '0')}`;
    }

    /**
     * Código único de idempotencia ante Factus: DS-YYYY-secuencial.
     */
    private async generarReferenceCode(): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = `DS-${year}-`;
        const ultimo = await this.documentoRepository.createQueryBuilder('doc')
            .where('doc.referenceCode LIKE :prefix', { prefix: `${prefix}%` })
            .orderBy('doc.referenceCode', 'DESC')
            .getOne();

        const ultimoNumero = ultimo?.referenceCode ? parseInt(ultimo.referenceCode.split('-')[2]) : 0;
        return `${prefix}${(ultimoNumero + 1).toString().padStart(6, '0')}`;
    }

    private async calcularTotales(queryRunner: QueryRunner, items: CreateDocumentoSoporteItemDto[]):
        Promise<{ subtotal: number; totalIva: number; descuento: number, detalles: Partial<DocumentoSoporteDetalle>[] }> {

        let subtotal = 0;
        let totalIva = 0;
        let descuento = 0;
        const detalles: Partial<DocumentoSoporteDetalle>[] = [];

        for (const item of items) {
            let articulo: Articulo | null = null;
            let cuentaContable: CuentaContable | null = null;

            if (item.articuloId) {
                articulo = await queryRunner.manager.findOne(Articulo, {
                    where: { id: item.articuloId },
                    relations: ['categoriaArticulo', 'categoriaArticulo.cuentaPrincipal', 'impuestoRel']
                });

                if (!articulo) throw new NotFoundException(`Producto no encontrado: ${item.articuloId}`);
                if (!articulo.isActive) throw new BadRequestException(`El producto ${articulo.nombre} no está activo`);
            } else if (item.cuentaContableId) {
                cuentaContable = await queryRunner.manager.findOne(CuentaContable, {
                    where: { id: item.cuentaContableId }
                });

                if (!cuentaContable) throw new NotFoundException(`Cuenta contable con ID ${item.cuentaContableId} no encontrada`);
                if (!cuentaContable.isActive) throw new BadRequestException(`La cuenta contable ${cuentaContable.nombre} no está activa`);
            } else {
                throw new BadRequestException('Cada ítem debe tener un artículo o una cuenta contable');
            }

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
                impuestoIdSeleccionado = articulo ? (articulo.impuestoId || undefined) : undefined;
            }

            const totalSinDescuento = MathUtil.mul(precioUnitario, cantidad);
            const descuentoValor = MathUtil.percentage(totalSinDescuento, porcentajeDescuento);
            const itemImporte = MathUtil.sub(totalSinDescuento, descuentoValor);
            const valorIva = MathUtil.percentage(itemImporte, porcentajeIva);

            const itemTotal = MathUtil.sum(itemImporte, valorIva);

            detalles.push({
                articuloId: articulo ? articulo.id : null,
                cuentaContableId: cuentaContable ? cuentaContable.id : null,
                descripcion: item.descripcion || (articulo ? articulo.nombre : (cuentaContable ? `${cuentaContable.codigo} - ${cuentaContable.nombre}` : '')),
                quantity: cantidad,
                unitPrice: precioUnitario,
                porcentajeIva: porcentajeIva,
                impuestoId: impuestoIdSeleccionado,
                descuento: porcentajeDescuento,
                valorSubtotal: totalSinDescuento,
                valorIva: valorIva,
                valorDescuento: descuentoValor,
                itemTotal: itemTotal
            });

            subtotal = MathUtil.sum(subtotal, totalSinDescuento);
            totalIva = MathUtil.sum(totalIva, valorIva);
            descuento = MathUtil.sum(descuento, descuentoValor);
        }

        return { subtotal, totalIva, descuento, detalles };
    }
}
