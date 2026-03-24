import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CuentasBancarias } from './entities/cuentas-bancaria.entity';

@Injectable()
export class CuentasBancariasService {
  constructor(
    @InjectRepository(CuentasBancarias)
    private readonly cuentasBancariasRepository: Repository<CuentasBancarias>,
  ) {}

  async create(createCuentasBancariaDto: CreateCuentasBancariaDto) {
    try {
      const { bancoId, ...rest } = createCuentasBancariaDto;
      
      const cuentaBancaria = this.cuentasBancariasRepository.create({
        ...rest,
        banco: { id: bancoId } as any,
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

  async findAll() {
    try {
      const cuentasBancarias = await this.cuentasBancariasRepository.find({
        where: { activa: true },
        order: { nombre: 'ASC' },
        relations: ['banco'],
      });

      return {
        message: 'Cuentas bancarias obtenidas exitosamente',
        data: cuentasBancarias
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
        cuentaBancaria.banco = { id: bancoId } as any;
        
      }

      await this.cuentasBancariasRepository.update(id, rest);

      return {
        message: 'Cuenta bancaria actualizada exitosamente',
        data: cuentaBancaria
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

      await this.cuentasBancariasRepository.remove(cuentaBancaria);

      return {
        message: 'Cuenta bancaria eliminada exitosamente'
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al eliminar la cuenta bancaria');
    }
  }
}
