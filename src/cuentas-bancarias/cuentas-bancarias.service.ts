import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CuentasBancarias } from './entities/cuentas-bancaria.entity';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { Banco } from 'src/bancos/entities/banco.entity';
import { AsientosContablesService } from 'src/asientos-contables/asientos-contables.service';
import { MathUtil } from 'src/common/utils/math.util';

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
  ) {}

  async create(createCuentasBancariaDto: CreateCuentasBancariaDto, userId: string) {
    try {
      const { bancoId, saldoInicial, cuentaContrapartidaCodigo, ...rest } = createCuentasBancariaDto;
      
      const banco = await this.bancosRepository.findOne({ where: { id: bancoId } });
      if (!banco) {
        throw new NotFoundException('Banco no encontrado');
      }

      const saldo = saldoInicial && saldoInicial > 0 ? saldoInicial : 0;

      if (saldo > 0) {
        if (!cuentaContrapartidaCodigo) {
          throw new BadRequestException('Debe seleccionar una cuenta contrapartida cuando el saldo inicial es mayor a 0');
        }
      }
      
      const cuentaBancaria = this.cuentasBancariasRepository.create({
        ...rest,
        banco,
        saldoInicial: saldo,
        saldoActual: saldo,
      });

      const saved = await this.cuentasBancariasRepository.save(cuentaBancaria);

      if(saldo > 0 && cuentaContrapartidaCodigo) {
        try {
          await this.asientosContablesService.generarAsientoSaldoInicial({
            nombreCuenta: saved.nombre,
            monto: saldo,
            cuentaContrapartidaCodigo,
            userId,
          });
          this.logger.log(`Asiento de saldo inicial generado para cuenta ${saved.nombre}: $${saldo}`);
        } catch (asientoError) {
          this.logger.error(`Error generando asiento de saldo inicial: ${asientoError.message}`);
        }
      }

      return {
        message: 'Cuenta bancaria creada exitosamente',
        data: saved
      };
      
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al crear la cuenta bancaria');
    }
  }

  async findAll(paginationDto: PaginatioDto) {
    try {
      const { limit = 10, offset = 0 } = paginationDto;

      const [cuentasBancarias, total] = await this.cuentasBancariasRepository.findAndCount({
        where: { activa: true },
        order: { nombre: 'ASC' },
        relations: ['banco'],
        take: limit,
        skip: offset,
      });

      return {
        message: 'Cuentas bancarias obtenidas exitosamente',
        cuentas: cuentasBancarias,
        count: total,
        pages: Math.ceil(total / limit),
      };

    } catch (error) {
      throw new InternalServerErrorException('Error al obtener las cuentas bancarias');
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
        data: cuentaBancaria
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al obtener la cuenta bancaria');
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

      const { bancoId, ...rest } = updateCuentasBancariaDto;

      if (bancoId) {
        const banco = await this.bancosRepository.findOne({ where: { id: bancoId } });
        if (!banco) {
          throw new NotFoundException('Banco no encontrado');
        }
        cuentaBancaria.banco = banco;
      }

      await this.cuentasBancariasRepository.update(id, rest);

      return {
        message: 'Cuenta bancaria actualizada exitosamente',
        data: cuentaBancaria,
      };
      
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al actualizar la cuenta bancaria');
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

      await this.cuentasBancariasRepository.softRemove(cuentaBancaria);

      return {
        message: 'Cuenta bancaria eliminada exitosamente'
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al eliminar la cuenta bancaria');
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
      const origen = await queryRunner.manager.findOne(CuentasBancarias, {
        where: { id: dto.cuentaOrigenId },
        relations: ['banco'],
      });

      if (!origen || !origen.activa) {
        throw new NotFoundException('Cuenta de origen no encontrada o inactiva');
      }

      const destino = await queryRunner.manager.findOne(CuentasBancarias, {
        where: { id: dto.cuentaDestinoId },
        relations: ['banco'],
      });

      if (!destino || !destino.activa) {
        throw new NotFoundException('Cuenta de destino no encontrada o inactiva');
      }

      origen.saldoActual = MathUtil.sub(Number(origen.saldoActual), dto.monto);
      destino.saldoActual = MathUtil.sum(Number(destino.saldoActual), dto.monto);

      await queryRunner.manager.save(CuentasBancarias, origen);
      await queryRunner.manager.save(CuentasBancarias, destino);

      try {
        await this.asientosContablesService.generarAsientoTransferencia({
          nombreOrigen: `${origen.banco.nombre} - ${origen.nombre}`,
          nombreDestino: `${destino.banco.nombre} - ${destino.nombre}`,
          monto: dto.monto,
          userId,
        });
        this.logger.log(`Asiento de transferencia generado: $${dto.monto} | ${origen.nombre} -> ${destino.nombre}`);
      } catch (asientoError) {
        this.logger.error(`Error generando asiento de transferencia: ${asientoError.message}`);
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Transferencia realizada exitosamente',
        data: { origen, destino }
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error en transferencia: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al realizar la transferencia');
    } finally {
      await queryRunner.release();
    }
  }
}
