import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TipoComprobante } from './entities/tipo-comprobante.entity';
import { ComprobanteContable, EstadoComprobante } from './entities/comprobante-contable.entity';
import { ComprobanteDetalle } from './entities/comprobante-detalle.entity';
import { ComprobantesValidatorService } from './comprobantes-validator.service';
import { ContabilizacionEngine } from 'src/asientos-contables/engine/contabilizacion.engine';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import {
  CreateTipoComprobanteDto,
  UpdateTipoComprobanteDto,
} from './dto/tipo-comprobante.dto';
import {
  CreateComprobanteContableDto,
  UpdateComprobanteContableDto,
} from './dto/comprobante-contable.dto';

@Injectable()
export class ComprobantesService {
  constructor(
    @InjectRepository(TipoComprobante)
    private readonly tipoRepository: Repository<TipoComprobante>,

    @InjectRepository(ComprobanteContable)
    private readonly comprobanteRepository: Repository<ComprobanteContable>,

    @InjectRepository(ComprobanteDetalle)
    private readonly detalleRepository: Repository<ComprobanteDetalle>,

    private readonly validatorService: ComprobantesValidatorService,
    private readonly contabilizacionEngine: ContabilizacionEngine,
    private readonly asientosService: AsientosContablesService,
    private readonly dataSource: DataSource,
  ) { }

  // ══════════════════════════════════════════════════════════════════════════ 
  // A. ADMINISTRACIÓN DE TIPOS DE COMPROBANTES (CONFIGURACIÓN)
  // ══════════════════════════════════════════════════════════════════════════

  async createTipo(dto: CreateTipoComprobanteDto): Promise<TipoComprobante> {
    const existe = await this.tipoRepository.findOne({
      where: { codigo: dto.codigo.toUpperCase() },
    });
    if (existe) {
      throw new BadRequestException(`Ya existe un tipo de comprobante con el código ${dto.codigo}`);
    }

    const nuevo = this.tipoRepository.create({
      ...dto,
      codigo: dto.codigo.toUpperCase(),
      prefijo: dto.prefijo ? dto.prefijo.toUpperCase() : undefined,
    });
    return this.tipoRepository.save(nuevo);
  }

  async findAllTipos(): Promise<TipoComprobante[]> {
    return this.tipoRepository.find({ order: { nombre: 'ASC' } });
  }

  async findOneTipo(id: string): Promise<TipoComprobante> {
    const tipo = await this.tipoRepository.findOne({ where: { id } });
    if (!tipo) {
      throw new NotFoundException(`Tipo de comprobante con ID ${id} no encontrado`);
    }
    return tipo;
  }

  async updateTipo(id: string, dto: UpdateTipoComprobanteDto): Promise<TipoComprobante> {
    const tipo = await this.findOneTipo(id);
    const updateData: Partial<TipoComprobante> = { ...dto };
    if (dto.prefijo) {
      updateData.prefijo = dto.prefijo.toUpperCase();
    }
    Object.assign(tipo, updateData);
    return this.tipoRepository.save(tipo);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // B. GESTIÓN DE COMPROBANTES CONTABLES
  // ══════════════════════════════════════════════════════════════════════════

  async create(dto: CreateComprobanteContableDto, userId: string): Promise<ComprobanteContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tipo = await queryRunner.manager.findOne(TipoComprobante, {
        where: { id: dto.tipoComprobanteId, activo: true },
      });

      if (!tipo) {
        throw new NotFoundException('El tipo de comprobante seleccionado no existe o está inactivo.');
      }

      // Validar las reglas de negocio (balance, auxiliares, terceros, centros)
      await this.validatorService.validarComprobante(tipo, dto.detalles);

      // Generar consecutivo secuencial
      let numero = '';
      if (tipo.numeracionAutomatica) {
        const consecutivoStr = String(tipo.consecutivoActual).padStart(4, '0');
        numero = tipo.prefijo ? `${tipo.prefijo}-${consecutivoStr}` : consecutivoStr;

        // Incrementar el consecutivo
        tipo.consecutivoActual += 1;
        await queryRunner.manager.save(TipoComprobante, tipo);
      } else {
        // En caso de numeración manual, se podría pasar en el DTO (ampliación futura)
        throw new BadRequestException('La numeración manual no está soportada en esta fase.');
      }

      // Calcular totales
      const totalDebito = dto.detalles.reduce((sum, d) => sum + Number(d.debito || 0), 0);
      const totalCredito = dto.detalles.reduce((sum, d) => sum + Number(d.credito || 0), 0);

      const comprobante = queryRunner.manager.create(ComprobanteContable, {
        tipoComprobanteId: tipo.id,
        numero,
        fechaDocumento: new Date(dto.fechaDocumento),
        observaciones: dto.observaciones,
        estado: EstadoComprobante.BORRADOR,
        totalDebito,
        totalCredito,
        creadoPorId: userId,
      });

      const guardado = await queryRunner.manager.save(ComprobanteContable, comprobante);

      // Guardar detalles
      for (const det of dto.detalles) {
        const detalle = queryRunner.manager.create(ComprobanteDetalle, {
          comprobanteId: guardado.id,
          cuentaContableId: det.cuentaContableId,
          descripcion: det.descripcion,
          debito: det.debito,
          credito: det.credito,
          clienteId: det.clienteId || undefined,
          proveedorId: det.proveedorId || undefined,
          entidadSSId: det.entidadSSId || undefined,
          centroCostoId: det.centroCostoId || undefined,
          documentoReferencia: det.documentoReferencia || undefined,
        });
        await queryRunner.manager.save(ComprobanteDetalle, detalle);
      }

      await queryRunner.commitTransaction();
      return this.findOne(guardado.id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, dto: UpdateComprobanteContableDto, userId: string): Promise<ComprobanteContable> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const comprobante = await queryRunner.manager.findOne(ComprobanteContable, {
        where: { id },
      });

      if (!comprobante) {
        throw new NotFoundException(`Comprobante contable con ID ${id} no encontrado.`);
      }

      if (comprobante.estado !== EstadoComprobante.BORRADOR) {
        throw new ForbiddenException('No se puede modificar un comprobante que ya está contabilizado o anulado.');
      }

      const tipo = await queryRunner.manager.findOne(TipoComprobante, {
        where: { id: comprobante.tipoComprobanteId },
      });

      if (!tipo) {
        throw new NotFoundException('El tipo de comprobante no existe.');
      }

      if (dto.fechaDocumento) {
        comprobante.fechaDocumento = new Date(dto.fechaDocumento);
      }
      if (dto.observaciones !== undefined) {
        comprobante.observaciones = dto.observaciones;
      }

      if (dto.detalles) {
        // Validar nuevos movimientos
        await this.validatorService.validarComprobante(tipo, dto.detalles);

        // Eliminar detalles viejos
        await queryRunner.manager.delete(ComprobanteDetalle, { comprobanteId: id });

        // Insertar nuevos detalles
        for (const det of dto.detalles) {
          const detalle = queryRunner.manager.create(ComprobanteDetalle, {
            comprobanteId: id,
            cuentaContableId: det.cuentaContableId,
            descripcion: det.descripcion,
            debito: det.debito,
            credito: det.credito,
            clienteId: det.clienteId || undefined,
            proveedorId: det.proveedorId || undefined,
            entidadSSId: det.entidadSSId || undefined,
            centroCostoId: det.centroCostoId || undefined,
            documentoReferencia: det.documentoReferencia || undefined,
          });
          await queryRunner.manager.save(ComprobanteDetalle, detalle);
        }

        // Recalcular totales
        comprobante.totalDebito = dto.detalles.reduce((sum, d) => sum + Number(d.debito || 0), 0);
        comprobante.totalCredito = dto.detalles.reduce((sum, d) => sum + Number(d.credito || 0), 0);
      }

      comprobante.modificadoPorId = userId;
      await queryRunner.manager.save(ComprobanteContable, comprobante);

      await queryRunner.commitTransaction();
      return this.findOne(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: string): Promise<ComprobanteContable> {
    const comprobante = await this.comprobanteRepository.findOne({
      where: { id },
      relations: [
        'tipoComprobante',
        'detalles',
        'detalles.cuentaContable',
        'detalles.cliente',
        'detalles.proveedor',
        'detalles.entidadSS',
        'detalles.centroCosto',
        'creadoPor',
        'modificadoPor',
        'contabilizadoPor',
        'anuladoPor',
      ],
    });

    if (!comprobante) {
      throw new NotFoundException(`Comprobante contable con ID ${id} no encontrado.`);
    }

    return comprobante;
  }

  async findAll(): Promise<ComprobanteContable[]> {
    return this.comprobanteRepository.find({
      relations: ['tipoComprobante', 'creadoPor'],
      order: { createdAt: 'DESC' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // C. CONTABILIZACIÓN Y ANULACIÓN (ACCIONES)
  // ══════════════════════════════════════════════════════════════════════════

  async contabilizar(id: string, userId: string): Promise<ComprobanteContable> {
    const comprobante = await this.findOne(id);

    if (comprobante.estado !== EstadoComprobante.BORRADOR) {
      throw new BadRequestException('Solo se pueden contabilizar comprobantes en estado BORRADOR.');
    }

    // Convertir detalles de la base de datos a DTO para validar antes de procesar
    const detallesDto = comprobante.detalles.map((d) => ({
      cuentaContableId: d.cuentaContableId,
      debito: Number(d.debito),
      credito: Number(d.credito),
      clienteId: d.clienteId,
      proveedorId: d.proveedorId,
      centroCostoId: d.centroCostoId,
      documentoReferencia: d.documentoReferencia,
    }));

    if (!comprobante.tipoComprobante) {
      throw new BadRequestException('El comprobante no tiene un tipo de comprobante asociado.');
    }

    await this.validatorService.validarComprobante(comprobante.tipoComprobante, detallesDto);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Registrar el asiento definitivo en el motor contable
      const asiento = await this.contabilizacionEngine.contabilizarDocumento(
        'COMPROBANTE_CONTABLE',
        id,
        userId,
        queryRunner,
      );

      // Marcar comprobante como CONTABILIZADO y vincular asiento
      comprobante.estado = EstadoComprobante.CONTABILIZADO;
      comprobante.fechaContabilizacion = new Date();
      comprobante.contabilizadoPorId = userId;
      comprobante.asientoId = asiento.id;

      await queryRunner.manager.save(ComprobanteContable, comprobante);

      await queryRunner.commitTransaction();
      return this.findOne(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async anular(id: string, motivo: string, userId: string): Promise<ComprobanteContable> {
    const comprobante = await this.findOne(id);

    if (comprobante.estado !== EstadoComprobante.CONTABILIZADO) {
      throw new BadRequestException('Solo se pueden anular comprobantes en estado CONTABILIZADO.');
    }

    if (!comprobante.asientoId) {
      throw new BadRequestException('El comprobante no tiene un asiento contable asociado.');
    }

    if (!motivo || motivo.trim() === '') {
      throw new BadRequestException('Debe proporcionar un motivo de anulación válido.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generar el asiento de reverso
      await this.asientosService.generarAsientoReverso(
        comprobante.asientoId,
        'ANULACION_COMPROBANTE' as any, // TipoAsiento
        userId,
        queryRunner,
      );

      // Actualizar el estado del comprobante
      comprobante.estado = EstadoComprobante.ANULADO;
      comprobante.fechaAnulacion = new Date();
      comprobante.anuladoPorId = userId;
      comprobante.motivoAnulacion = motivo;

      await queryRunner.manager.save(ComprobanteContable, comprobante);

      await queryRunner.commitTransaction();
      return this.findOne(id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
