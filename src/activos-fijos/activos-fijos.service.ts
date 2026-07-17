import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { ActivoFijo, EstadoActivo } from './entities/activo-fijo.entity';
import { DepreciacionActivoFijo } from './entities/depreciacion-activo-fijo.entity';
import { CreateActivoFijoDto } from './dto/create-activo-fijo.dto';
import { UpdateActivoFijoDto } from './dto/update-activo-fijo.dto';
import { DepreciarPeriodoDto } from './dto/depreciar-periodo.dto';
import { RetirarActivoDto } from './dto/retirar-activo.dto';
import { AsientosContablesService } from '../asientos-contables/asientos-contables.service';
import { CuentaContable } from '../cuentas/entities/cuenta.entity';
import { DefinicionAsientoDto, DefinicionDetalleAsientoDto } from '../asientos-contables/dto/definicion-asiento.dto';
import { TipoAsiento } from '../asientos-contables/entities/asientos-contable.entity';

@Injectable()
export class ActivosFijosService {
  constructor(
    @InjectRepository(ActivoFijo)
    private readonly activoRepository: Repository<ActivoFijo>,
    @InjectRepository(DepreciacionActivoFijo)
    private readonly depreciacionRepository: Repository<DepreciacionActivoFijo>,
    private readonly asientosService: AsientosContablesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateActivoFijoDto): Promise<ActivoFijo> {
    const existing = await this.activoRepository.findOne({ where: { codigo: createDto.codigo } });
    if (existing) {
      throw new BadRequestException(`El activo con código ${createDto.codigo} ya está registrado`);
    }

    // Validar existencia de cuentas
    await this.validarCuenta(createDto.cuentaActivoId, 'ACTIVO');
    await this.validarCuenta(createDto.cuentaDepreciacionAcumuladaId, 'ACTIVO');
    await this.validarCuenta(createDto.cuentaGastoDepreciacionId, 'GASTO');

    const valorSalvamento = createDto.valorSalvamento ?? 0;
    const activo = this.activoRepository.create({
      ...createDto,
      valorSalvamento,
      depreciacionAcumulada: 0,
      valorLibros: createDto.valorAdquisicion,
      estado: EstadoActivo.ACTIVO,
    });

    return this.activoRepository.save(activo);
  }

  async findAll(): Promise<ActivoFijo[]> {
    return this.activoRepository.find({ order: { codigo: 'ASC' } });
  }

  async findOne(id: string): Promise<ActivoFijo> {
    const activo = await this.activoRepository.findOne({
      where: { id },
      relations: ['cuentaActivo', 'cuentaDepreciacionAcumulada', 'cuentaGastoDepreciacion', 'proveedor', 'centroCosto'],
    });
    if (!activo) throw new NotFoundException('Activo fijo no encontrado');
    return activo;
  }

  async getDepreciaciones(activoId: string): Promise<DepreciacionActivoFijo[]> {
    return this.depreciacionRepository.find({
      where: { activoFijoId: activoId },
      relations: ['asientoContable'],
      order: { anio: 'DESC', mes: 'DESC' },
    });
  }

  async update(id: string, updateDto: UpdateActivoFijoDto): Promise<ActivoFijo> {
    const activo = await this.findOne(id);
    if (activo.estado !== EstadoActivo.ACTIVO) {
      throw new BadRequestException('Solo se pueden modificar activos fijos en estado ACTIVO');
    }

    if (updateDto.cuentaActivoId) {
      await this.validarCuenta(updateDto.cuentaActivoId, 'ACTIVO');
      activo.cuentaActivo = { id: updateDto.cuentaActivoId } as any;
    }
    if (updateDto.cuentaDepreciacionAcumuladaId) {
      await this.validarCuenta(updateDto.cuentaDepreciacionAcumuladaId, 'ACTIVO');
      activo.cuentaDepreciacionAcumulada = { id: updateDto.cuentaDepreciacionAcumuladaId } as any;
    }
    if (updateDto.cuentaGastoDepreciacionId) {
      await this.validarCuenta(updateDto.cuentaGastoDepreciacionId, 'GASTO');
      activo.cuentaGastoDepreciacion = { id: updateDto.cuentaGastoDepreciacionId } as any;
    }

    if (updateDto.proveedorId !== undefined) {
      activo.proveedor = updateDto.proveedorId ? ({ id: updateDto.proveedorId } as any) : null;
    }
    if (updateDto.centroCostoId !== undefined) {
      activo.centroCosto = updateDto.centroCostoId ? ({ id: updateDto.centroCostoId } as any) : null;
    }

    Object.assign(activo, updateDto);
    return this.activoRepository.save(activo);
  }

  async depreciarPeriodo(dto: DepreciarPeriodoDto, userId: string): Promise<{ procesados: number }> {
    const { anio, mes } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Obtener activos activos elegibles
      const activos = await queryRunner.manager.find(ActivoFijo, {
        where: { estado: EstadoActivo.ACTIVO },
        relations: ['cuentaActivo', 'cuentaDepreciacionAcumulada', 'cuentaGastoDepreciacion'],
      });

      let procesados = 0;

      // Definir último día del mes para la fecha del asiento
      const fechaAsiento = new Date(anio, mes, 0); // día 0 del mes siguiente es el último del mes deseado

      for (const activo of activos) {
        // Validaciones por activo:
        // A. No depreciar si la fecha de adquisición es posterior
        const fechaAdq = new Date(activo.fechaAdquisicion);
        if (fechaAdq > fechaAsiento) continue;

        // B. Validar si ya se depreció este periodo
        const yaDepreciado = await queryRunner.manager.findOne(DepreciacionActivoFijo, {
          where: { activoFijoId: activo.id, anio, mes },
        });
        if (yaDepreciado) continue;

        // Calcular monto mensual
        const totalDepreciable = activo.valorAdquisicion - activo.valorSalvamento;
        if (totalDepreciable <= 0) continue;

        let montoDepreciacion = totalDepreciable / activo.vidaUtilMeses;

        // Asegurar que no supere el valor residual
        const nuevoValorLibros = activo.valorLibros - montoDepreciacion;
        if (nuevoValorLibros < activo.valorSalvamento) {
          montoDepreciacion = activo.valorLibros - activo.valorSalvamento;
        }

        if (montoDepreciacion <= 0) {
          activo.estado = EstadoActivo.DEPRECIADO;
          await queryRunner.manager.save(ActivoFijo, activo);
          continue;
        }

        // 2. Generar Asiento Contable individual por activo para mejor trazabilidad
        const cuentaGasto = activo.cuentaGastoDepreciacion;
        const cuentaDepAcumulada = activo.cuentaDepreciacionAcumulada;

        const detalles: DefinicionDetalleAsientoDto[] = [
          {
            cuentaId: cuentaGasto.id,
            cuentaCodigo: cuentaGasto.codigo,
            cuentaNombre: cuentaGasto.nombre,
            debito: montoDepreciacion,
            credito: 0,
            concepto: `Depreciación mensual ${mes}/${anio} - Activo: ${activo.codigo} (${activo.nombre})`,
            centroCostoId: activo.centroCostoId || undefined,
          },
          {
            cuentaId: cuentaDepAcumulada.id,
            cuentaCodigo: cuentaDepAcumulada.codigo,
            cuentaNombre: cuentaDepAcumulada.nombre,
            debito: 0,
            credito: montoDepreciacion,
            concepto: `Depreciación acumulada ${mes}/${anio} - Activo: ${activo.codigo} (${activo.nombre})`,
            centroCostoId: activo.centroCostoId || undefined,
          }
        ];

        const definicionAsiento: DefinicionAsientoDto = {
          tipo: TipoAsiento.COMPROBANTE_CONTABLE,
          fecha: fechaAsiento,
          referencia: `DEP-${activo.codigo}-${mes}-${anio}`,
          descripcion: `Proceso automático de depreciación del activo ${activo.codigo} para el periodo ${mes}/${anio}`,
          detalles,
          totalDebito: montoDepreciacion,
          totalCredito: montoDepreciacion,
          estaBalanceado: true,
          diferencia: 0,
        };

        const asiento = await this.asientosService.crearAsientoDesdeDefinicion(definicionAsiento, userId, queryRunner);

        // 3. Crear log de depreciación
        const log = queryRunner.manager.create(DepreciacionActivoFijo, {
          activoFijoId: activo.id,
          anio,
          mes,
          monto: montoDepreciacion,
          asientoContableId: asiento.id,
        });
        await queryRunner.manager.save(DepreciacionActivoFijo, log);

        // 4. Actualizar activo fijo
        activo.depreciacionAcumulada += montoDepreciacion;
        activo.valorLibros = activo.valorAdquisicion - activo.depreciacionAcumulada;
        
        if (activo.valorLibros <= activo.valorSalvamento) {
          activo.estado = EstadoActivo.DEPRECIADO;
        }

        await queryRunner.manager.save(ActivoFijo, activo);
        procesados++;
      }

      await queryRunner.commitTransaction();
      return { procesados };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async retirarActivo(id: string, dto: RetirarActivoDto, userId: string): Promise<ActivoFijo> {
    const activo = await this.findOne(id);
    if (activo.estado === EstadoActivo.RETIRADO || activo.estado === EstadoActivo.VENDIDO) {
      throw new BadRequestException('El activo ya se encuentra retirado o vendido');
    }

    const { fecha, motivo, valorVenta, cuentaBancoCajaId, cuentaIngresoRetiroId, cuentaPerdidaRetiroId } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const valorLibrosActual = activo.valorLibros;
      const gananciaOPerdida = valorVenta - valorLibrosActual;

      const detalles: DefinicionDetalleAsientoDto[] = [];

      // A. Cancelar Depreciación Acumulada (Débito)
      if (activo.depreciacionAcumulada > 0) {
        detalles.push({
          cuentaId: activo.cuentaDepreciacionAcumuladaId,
          cuentaCodigo: activo.cuentaDepreciacionAcumulada.codigo,
          cuentaNombre: activo.cuentaDepreciacionAcumulada.nombre,
          debito: activo.depreciacionAcumulada,
          credito: 0,
          concepto: `Cancelación dep. acumulada por retiro de activo: ${activo.codigo}`,
        });
      }

      // B. Cancelar Cuenta del Activo (Crédito)
      detalles.push({
        cuentaId: activo.cuentaActivoId,
        cuentaCodigo: activo.cuentaActivo.codigo,
        cuentaNombre: activo.cuentaActivo.nombre,
        debito: 0,
        credito: activo.valorAdquisicion,
        concepto: `Cancelación costo histórico por retiro de activo: ${activo.codigo}`,
      });

      // C. Si hay valor de venta, registrar ingreso en Banco/Caja (Débito)
      if (valorVenta > 0) {
        if (!cuentaBancoCajaId) {
          throw new BadRequestException('Debe especificar la cuenta de Banco/Caja para registrar el ingreso de la venta');
        }
        const cuentaBanco = await queryRunner.manager.findOne(CuentaContable, { where: { id: cuentaBancoCajaId } });
        if (!cuentaBanco) throw new BadRequestException('Cuenta de Banco/Caja no encontrada');

        detalles.push({
          cuentaId: cuentaBanco.id,
          cuentaCodigo: cuentaBanco.codigo,
          cuentaNombre: cuentaBanco.nombre,
          debito: valorVenta,
          credito: 0,
          concepto: `Ingreso por venta de activo fijo: ${activo.codigo}`,
          proveedorId: activo.proveedorId || undefined,
        });
      }

      // D. Registrar Ganancia o Pérdida
      if (gananciaOPerdida > 0) {
        const idCuentaIngreso = cuentaIngresoRetiroId || await this.obtenerCuentaPorDefecto('ingreso_retiro', '4210');
        const cuentaIngreso = await queryRunner.manager.findOne(CuentaContable, { where: { id: idCuentaIngreso } });
        if (!cuentaIngreso) throw new BadRequestException('Cuenta de Ganancia/Ingreso no encontrada');

        detalles.push({
          cuentaId: cuentaIngreso.id,
          cuentaCodigo: cuentaIngreso.codigo,
          cuentaNombre: cuentaIngreso.nombre,
          debito: 0,
          credito: gananciaOPerdida,
          concepto: `Ganancia en venta de activo fijo: ${activo.codigo}`,
        });
      } else if (gananciaOPerdida < 0) {
        const idCuentaGasto = cuentaPerdidaRetiroId || await this.obtenerCuentaPorDefecto('perdida_retiro', '5310');
        const cuentaGasto = await queryRunner.manager.findOne(CuentaContable, { where: { id: idCuentaGasto } });
        if (!cuentaGasto) throw new BadRequestException('Cuenta de Pérdida/Gasto no encontrada');

        detalles.push({
          cuentaId: cuentaGasto.id,
          cuentaCodigo: cuentaGasto.codigo,
          cuentaNombre: cuentaGasto.nombre,
          debito: Math.abs(gananciaOPerdida),
          credito: 0,
          concepto: `Pérdida por retiro/baja de activo fijo: ${activo.codigo}`,
        });
      }

      // Calcular totales para validar asiento balanceado
      const totalDebito = detalles.reduce((sum, d) => sum + d.debito, 0);
      const totalCredito = detalles.reduce((sum, d) => sum + d.credito, 0);

      const definicionAsiento: DefinicionAsientoDto = {
        tipo: TipoAsiento.COMPROBANTE_CONTABLE,
        fecha: new Date(fecha),
        referencia: `BAJA-${activo.codigo}`,
        descripcion: `Retiro de activo fijo ${activo.codigo}. Motivo: ${motivo}. Valor Venta: ${valorVenta}`,
        detalles,
        totalDebito,
        totalCredito,
        estaBalanceado: Math.abs(totalDebito - totalCredito) < 0.01,
        diferencia: 0,
      };

      await this.asientosService.crearAsientoDesdeDefinicion(definicionAsiento, userId, queryRunner);

      // Actualizar activo fijo
      activo.estado = valorVenta > 0 ? EstadoActivo.VENDIDO : EstadoActivo.RETIRADO;
      activo.valorLibros = 0;
      activo.depreciacionAcumulada = activo.valorAdquisicion; // Considerado totalmente depreciado a efectos de valor neto en libros

      const guardado = await queryRunner.manager.save(ActivoFijo, activo);
      await queryRunner.commitTransaction();
      return guardado;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async validarCuenta(cuentaId: string, tipoEsperado: 'ACTIVO' | 'GASTO'): Promise<void> {
    const cuenta = await this.dataSource.getRepository(CuentaContable).findOne({ where: { id: cuentaId } });
    if (!cuenta) {
      throw new BadRequestException(`La cuenta contable con ID ${cuentaId} no existe`);
    }
    if (cuenta.tipo !== tipoEsperado) {
      throw new BadRequestException(`La cuenta ${cuenta.codigo} debe ser de tipo ${tipoEsperado}`);
    }
    if (!cuenta.aceptaMovimiento) {
      throw new BadRequestException(`La cuenta ${cuenta.codigo} debe aceptar movimientos`);
    }
  }

  private async obtenerCuentaPorDefecto(tipo: string, codigoBuscado: string): Promise<string> {
    const cuenta = await this.dataSource.getRepository(CuentaContable).findOne({ where: { codigo: codigoBuscado } });
    if (!cuenta) {
      throw new BadRequestException(`No se pudo resolver la cuenta auxiliar por defecto: ${codigoBuscado}. Por favor configúrela manualmente.`);
    }
    return cuenta.id;
  }
}
