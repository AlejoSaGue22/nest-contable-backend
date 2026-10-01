import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import {
  CreateMovimientoBancarioDto,
  TipoMovimientoBancario,
} from './dto/create-movimiento-bancario.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CuentasBancarias,
  TipoCuentaBancaria,
} from './entities/cuentas-bancaria.entity';
import { Banco } from 'src/bancos/entities/banco.entity';
import { CuentasBancariasPaginationDto } from './dto/cuentas-bancarias-pagination.dto';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { MathUtil } from 'src/common/utils/math.util';
import { CuentaContable, NaturalezaCuenta } from 'src/cuentas/entities/cuenta.entity';
import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';

@Injectable()
export class CuentasBancariasService {
  private readonly logger = new Logger(CuentasBancariasService.name);

  constructor(
    @InjectRepository(CuentasBancarias)
    private readonly cuentasBancariasRepository: Repository<CuentasBancarias>,
    @InjectRepository(Banco)
    private readonly bancosRepository: Repository<Banco>,
    private readonly dataSource: DataSource,
    private readonly asientosContablesService: AsientosContablesService,
  ) { }

  /**
   * SRP: saldo contable real de una cuenta por código (fuente de verdad).
   * El saldo de la cuenta de naturaleza DÉBITO es débito-crédito.
   */
  private async getSaldoContableByCodigo(codigo: string): Promise<number> {
    const cuenta = await this.dataSource
      .getRepository(CuentaContable)
      .findOne({ where: { codigo } });
    if (!cuenta) {
      throw new NotFoundException(
        `Cuenta contable '${codigo}' no encontrada`,
      );
    }
    const raw: { debito: string | null; credito: string | null } | undefined =
      await this.dataSource
        .getRepository(AsientoDetalle)
        .createQueryBuilder('d')
        .select('SUM(d.debito)', 'debito')
        .addSelect('SUM(d.credito)', 'credito')
        .where('d.cuentaId = :cuentaId', { cuentaId: cuenta.id })
        .getRawOne();
    const debito = Number(raw?.debito ?? 0);
    const credito = Number(raw?.credito ?? 0);
    if (cuenta.naturaleza === NaturalezaCuenta.CREDITO) {
      return MathUtil.sub(credito, debito);
    }
    return MathUtil.sub(debito, credito);
  }

  async create(createCuentasBancariaDto: CreateCuentasBancariaDto, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let codigoSolicitado = '';
    try {
      const {
        bancoId,
        saldoInicial,
        cuentaContrapartidaCodigo,
        tipoCuenta,
        codigoCuentaContable,
        ...rest
      } = createCuentasBancariaDto;
      codigoSolicitado = codigoCuentaContable;

      if (tipoCuenta === TipoCuentaBancaria.BANCO && !bancoId) {
        throw new BadRequestException(
          'Debe seleccionar un banco cuando el tipo de cuenta es Banco',
        );
      }

      let banco: Banco | null = null;
      if (bancoId) {
        banco = await queryRunner.manager.findOne(Banco, {
          where: { id: bancoId },
        });
        if (!banco) {
          throw new NotFoundException('Banco no encontrado');
        }
      }

      const aporte = Number(saldoInicial ?? 0);

      // La cuenta contable asociada debe existir y estar activa.
      await this.asientosContablesService.obtenerCuentaPorCodigo(
        codigoCuentaContable,
      );
      // Cada banco/caja usa una subcuenta independiente: rechazar códigos
      // ya asociados a otra cuenta (excluye eliminadas por soft-delete).
      const codigoEnUso = await queryRunner.manager.findOne(CuentasBancarias, {
        where: { codigoCuentaContable },
      });
      if (codigoEnUso) {
        throw new ConflictException(
          `La cuenta contable '${codigoCuentaContable}' ya está asociada a '${codigoEnUso.nombre}'. Cada banco/caja debe tener su subcuenta independiente.`,
        );
      }
      // Hereda el saldo actual de su cuenta contable independiente.
      const saldoContable =
        await this.getSaldoContableByCodigo(codigoCuentaContable);

      if (aporte !== 0 && !cuentaContrapartidaCodigo) {
        throw new BadRequestException(
          'Debe seleccionar una cuenta contrapartida cuando el saldo inicial es distinto de 0',
        );
      }

      // El banco/caja mantiene el mismo saldo de su cuenta asociada más el agregado.
      const saldoFinal = MathUtil.sum(saldoContable, aporte);

      const cuentaBancaria = queryRunner.manager.create(CuentasBancarias, {
        ...rest,
        tipoCuenta,
        banco: banco || undefined,
        codigoCuentaContable,
        saldoInicial: saldoFinal,
        saldoActual: saldoFinal,
      });

      const saved = await queryRunner.manager.save(
        CuentasBancarias,
        cuentaBancaria,
      );

      if (aporte !== 0 && cuentaContrapartidaCodigo) {
        // Misma transacción: si el asiento falla, se revierte el banco.
        await this.asientosContablesService.generarAsientoSaldoInicial(
          {
            nombreCuenta: saved.nombre,
            monto: aporte,
            cuentaBancoCodigo: codigoCuentaContable,
            cuentaContrapartidaCodigo,
            userId,
          },
          queryRunner,
        );
        this.logger.log(
          `Asiento de saldo inicial generado para cuenta ${saved.nombre}: $${aporte}`,
        );
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Cuenta bancaria creada exitosamente',
        data: saved,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      // Condición de carrera: dos creaciones concurrentes con el mismo código;
      // la restricción única de BD decide (Postgres 23505).
      const driverCode = (error as { code?: string })?.code;
      if (driverCode === '23505') {
        throw new ConflictException(
          `La cuenta contable '${codigoSolicitado}' ya está asociada a otro banco/caja.`,
        );
      }
      throw new InternalServerErrorException(
        'Error al crear la cuenta bancaria',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(paginationDto: CuentasBancariasPaginationDto) {
    try {
      const page = paginationDto.offset || 1;
      const limit = paginationDto.limit || 10;
      const skip = (page - 1) * limit;

      const whereClause: { activa?: boolean } = {};
      if (paginationDto.estado === 'inactivo') {
        whereClause.activa = false;
      } else if (paginationDto.estado !== 'todos') {
        whereClause.activa = true; // default a activo
      }

      const [cuentasBancarias, total] =
        await this.cuentasBancariasRepository.findAndCount({
          where: whereClause,
          order: { nombre: 'ASC' },
          relations: ['banco'],
          take: limit,
          skip: skip,
        });

      return {
        message: 'Cuentas bancarias obtenidas exitosamente',
        cuentas: cuentasBancarias,
        count: total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener las cuentas bancarias',
      );
    }
  }

  async findOne(id: string) {
    try {
      const cuentaBancaria = await this.cuentasBancariasRepository.findOne({
        where: { id },
        relations: ['banco'],
      });

      if (!cuentaBancaria) {
        throw new NotFoundException('Cuenta bancaria no encontrada');
      }

      return {
        message: 'Cuenta bancaria obtenida exitosamente',
        data: cuentaBancaria,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Error al obtener la cuenta bancaria',
      );
    }
  }

  async update(id: string, updateCuentasBancariaDto: UpdateCuentasBancariaDto) {
    try {
      const cuentaBancaria = await this.cuentasBancariasRepository.findOne({
        where: { id },
      });

      if (!cuentaBancaria) {
        throw new NotFoundException('Cuenta bancaria no encontrada');
      }

      // El saldo y la subcuenta solo se mueven vía transferencia/movimiento
      // (generan asiento). Rechazar en vez de ignorar en silencio: el cliente
      // debe saber que su cambio no se aplicó.
      const BALANCE_FIELDS = [
        'saldoInicial',
        'saldoActual',
        'codigoCuentaContable',
        'cuentaContrapartidaCodigo',
      ] as const;
      const intentados = BALANCE_FIELDS.filter(
        (field) =>
          (updateCuentasBancariaDto as Record<string, unknown>)[field] !==
          undefined,
      );
      if (intentados.length > 0) {
        throw new BadRequestException(
          `No se puede modificar ${intentados.join(', ')} por esta vía; el saldo solo se mueve con transferencia o movimiento bancario`,
        );
      }

      // Prevent changing the account type
      const { bancoId, tipoCuenta, ...rest } = updateCuentasBancariaDto;

      if (tipoCuenta && tipoCuenta !== cuentaBancaria.tipoCuenta) {
        throw new BadRequestException(
          'No se permite cambiar el tipo de cuenta bancaria',
        );
      }

      if (bancoId) {
        const banco = await this.bancosRepository.findOne({
          where: { id: bancoId },
        });
        if (!banco) {
          throw new NotFoundException('Banco no encontrado');
        }
        cuentaBancaria.banco = banco;
      }

      // Solo campos escalares editables (nombre, numeroCuenta, observaciones);
      // se asignan sobre la entidad y se guardan junto con la relación banco.
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          (cuentaBancaria as unknown as Record<string, unknown>)[key] = value;
        }
      }
      await this.cuentasBancariasRepository.save(cuentaBancaria);

      const updated = await this.cuentasBancariasRepository.findOne({
        where: { id },
        relations: ['banco'],
      });

      return {
        message: 'Cuenta bancaria actualizada exitosamente',
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al actualizar la cuenta bancaria',
      );
    }
  }

  async remove(id: string) {
    try {
      const cuentaBancaria = await this.cuentasBancariasRepository.findOne({
        where: { id },
      });

      if (!cuentaBancaria) {
        throw new NotFoundException('Cuenta bancaria no encontrada');
      }

      if (Number(cuentaBancaria.saldoActual) !== 0) {
        throw new BadRequestException(
          'No se permite eliminar la cuenta bancaria porque tiene saldo. Realiza una transferencia o retiro para dejarla en $0 antes de proceder.',
        );
      }

      await this.cuentasBancariasRepository.softRemove(cuentaBancaria);

      return {
        message: 'Cuenta bancaria eliminada exitosamente',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al eliminar la cuenta bancaria');
    }
  }

  async toggleStatus(id: string) {
    try {
      const cuentaBancaria = await this.cuentasBancariasRepository.findOne({
        where: { id },
        relations: ['banco'],
      });

      if (!cuentaBancaria) {
        throw new NotFoundException('Cuenta bancaria no encontrada');
      }

      cuentaBancaria.activa = !cuentaBancaria.activa;
      await this.cuentasBancariasRepository.save(cuentaBancaria);

      return {
        message: cuentaBancaria.activa
          ? 'Cuenta bancaria activada exitosamente'
          : 'Cuenta bancaria inactivada exitosamente',
        data: cuentaBancaria,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al cambiar el estado de la cuenta bancaria');
    }
  }

  async transferir(dto: CreateTransferenciaDto, userId: string) {
    if (dto.cuentaOrigenId === dto.cuentaDestinoId) {
      throw new BadRequestException('La cuenta de origen y destino no pueden ser la misma');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloqueo pesimista en orden de id para evitar deadlocks entre
      // transferencias concurrentes en direcciones opuestas.
      const idsOrdenados = [dto.cuentaOrigenId, dto.cuentaDestinoId].sort();
      const bloqueadas = new Map<string, CuentasBancarias>();
      for (const id of idsOrdenados) {
        const encontrada = await queryRunner.manager.findOne(CuentasBancarias, {
          where: { id },
          relations: ['banco'],
          lock: { mode: 'pessimistic_write' },
        });
        if (encontrada) {
          bloqueadas.set(id, encontrada);
        }
      }

      const origen = bloqueadas.get(dto.cuentaOrigenId);

      if (!origen || !origen.activa) {
        throw new NotFoundException('Cuenta de origen no encontrada o inactiva');
      }

      const destino = bloqueadas.get(dto.cuentaDestinoId);

      if (!destino || !destino.activa) {
        throw new NotFoundException('Cuenta de destino no encontrada o inactiva');
      }

      origen.saldoActual = MathUtil.sub(Number(origen.saldoActual), dto.monto);
      destino.saldoActual = MathUtil.sum(
        Number(destino.saldoActual),
        dto.monto,
      );

      await queryRunner.manager.save(CuentasBancarias, origen);
      await queryRunner.manager.save(CuentasBancarias, destino);

      // Misma transacción banco ↔ contabilidad: si el asiento falla,
      // se revierten también los saldos (sin catch que lo oculte).
      await this.asientosContablesService.generarAsientoTransferencia(
        {
          nombreOrigen: origen.banco
            ? `${origen.banco.nombre} - ${origen.nombre}`
            : origen.nombre,
          nombreDestino: destino.banco
            ? `${destino.banco.nombre} - ${destino.nombre}`
            : destino.nombre,
          monto: dto.monto,
          codigoCuentaOrigen: origen.codigoCuentaContable,
          codigoCuentaDestino: destino.codigoCuentaContable,
          userId,
          observaciones: dto.observaciones,
        },
        queryRunner,
      );
      this.logger.log(
        `Asiento de transferencia generado: $${dto.monto} | ${origen.nombre} -> ${destino.nombre}`,
      );

      await queryRunner.commitTransaction();

      return {
        message: 'Transferencia realizada exitosamente',
        data: { origen, destino },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Error desconocido';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error en transferencia: ${message}`, stack);
      throw new InternalServerErrorException(
        'Error al realizar la transferencia',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Movimiento individual (ingreso/egreso) sobre un banco/caja.
   * Actualiza `saldoActual` y genera el asiento contra la subcuenta
   * propia del banco/caja, manteniendo la sincronía bidireccional.
   */
  async registrarMovimiento(
    id: string,
    dto: CreateMovimientoBancarioDto,
    userId: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuenta = await queryRunner.manager.findOne(CuentasBancarias, {
        where: { id },
        relations: ['banco'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!cuenta || !cuenta.activa) {
        throw new NotFoundException(
          'Cuenta bancaria no encontrada o inactiva',
        );
      }

      const delta =
        dto.tipo === TipoMovimientoBancario.INGRESO
          ? Number(dto.monto)
          : MathUtil.sub(0, Number(dto.monto));
      cuenta.saldoActual = MathUtil.sum(Number(cuenta.saldoActual), delta);

      await queryRunner.manager.save(CuentasBancarias, cuenta);

      // Misma transacción: si el asiento falla, se revierte el saldo.
      await this.asientosContablesService.generarAsientoMovimientoBanco(
        {
          nombreCuenta: cuenta.banco
            ? `${cuenta.banco.nombre} - ${cuenta.nombre}`
            : cuenta.nombre,
          monto: delta,
          cuentaBancoCodigo: cuenta.codigoCuentaContable,
          cuentaContrapartidaCodigo: dto.cuentaContrapartidaCodigo,
          userId,
          observaciones: dto.observaciones,
        },
        queryRunner,
      );
      this.logger.log(
        `Asiento de movimiento generado: $${delta} | ${cuenta.nombre}`,
      );

      await queryRunner.commitTransaction();

      return {
        message: 'Movimiento registrado exitosamente',
        data: cuenta,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Error desconocido';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error en movimiento bancario: ${message}`, stack);
      throw new InternalServerErrorException(
        'Error al registrar el movimiento',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
