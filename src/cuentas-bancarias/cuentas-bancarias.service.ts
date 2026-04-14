import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CuentasBancarias } from './entities/cuentas-bancaria.entity';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { Banco } from 'src/bancos/entities/banco.entity';

@Injectable()
export class CuentasBancariasService {
  constructor(
    @InjectRepository(CuentasBancarias)
    private readonly cuentasBancariasRepository: Repository<CuentasBancarias>,
    @InjectRepository(Banco)
    private readonly bancosRepository: Repository<Banco>,
  ) {}

  async create(createCuentasBancariaDto: CreateCuentasBancariaDto) {
    try {
      const { bancoId, ...rest } = createCuentasBancariaDto;
      
      const banco = await this.bancosRepository.findOne({ where: { id: bancoId } });
      if (!banco) {
        throw new NotFoundException('Banco no encontrado');
      }
      
      const cuentaBancaria = this.cuentasBancariasRepository.create({
        ...rest,
        banco,
      });

      await this.cuentasBancariasRepository.save(cuentaBancaria);

      return {
        message: 'Cuenta bancaria creada exitosamente',
        data: cuentaBancaria
      };
      
    } catch (error) {
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
}
