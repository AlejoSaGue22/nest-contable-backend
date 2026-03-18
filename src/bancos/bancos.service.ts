import { Injectable, InternalServerErrorException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banco } from './entities/banco.entity';
import { CreateBancoDto } from './dto/create-banco.dto';
import { UpdateBancoDto } from './dto/update-banco.dto';

@Injectable()
export class BancosService implements OnModuleInit {
  constructor(
    @InjectRepository(Banco)
    private readonly bancosRepository: Repository<Banco>,
  ) {}

  async onModuleInit() {
    await this.seedBancos();
  }

  async create(createBancoDto: CreateBancoDto) {
    try {
      const banco = this.bancosRepository.create(createBancoDto);
      await this.bancosRepository.save(banco);
      return {
        message: 'Banco creado exitosamente',
        data: banco,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error al crear el banco');
    }
  }

  async findAll() {
    try {
      const bancos = await this.bancosRepository.find({
        where: { activa: true },
        order: { nombre: 'ASC' },
      });
      return {
        message: 'Bancos obtenidos exitosamente',
        data: bancos,
      };
    } catch (error) {
      throw new InternalServerErrorException('Error al obtener los bancos');
    }
  }

  async findOne(id: string) {
    try {
      const banco = await this.bancosRepository.findOne({ where: { id } });
      if (!banco) {
        throw new NotFoundException('Banco no encontrado');
      }
      return {
        message: 'Banco obtenido exitosamente',
        data: banco,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al obtener el banco');
    }
  }

  async update(id: string, updateBancoDto: UpdateBancoDto) {
    try {
      const banco = await this.bancosRepository.preload({
        id,
        ...updateBancoDto,
      });

      if (!banco) {
        throw new NotFoundException('Banco no encontrado');
      }

      await this.bancosRepository.save(banco);
      return {
        message: 'Banco actualizado exitosamente',
        data: banco,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al actualizar el banco');
    }
  }

  async remove(id: string) {
    try {
      const banco = await this.findOne(id);
      await this.bancosRepository.remove(banco.data);
      return {
        message: 'Banco eliminado exitosamente',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al eliminar el banco');
    }
  }

  async seedBancos() {
    const bancosColombia = [
      { nombre: 'Bancolombia', nit: '890.903.938-8' },
      { nombre: 'Banco de Bogotá', nit: '860.002.964-4' },
      { nombre: 'Davivienda', nit: '860.034.313-7' },
      { nombre: 'BBVA Colombia', nit: '860.003.020-1' },
      { nombre: 'Banco de Occidente', nit: '890.300.279-4' },
      { nombre: 'Banco Popular', nit: '860.007.738-9' },
      { nombre: 'Citibank', nit: '860.024.180-2' },
      { nombre: 'GNB Sudameris', nit: '860.050.750-1' },
      { nombre: 'Scotiabank Colpatria', nit: '860.034.594-1' },
      { nombre: 'Itaú', nit: '800.161.737-0' },
      { nombre: 'Banco Falabella', nit: '900.047.282-4' },
      { nombre: 'Banco Pichincha', nit: '860.052.103-7' },
      { nombre: 'Banco AV Villas', nit: '860.035.827-5' },
      { nombre: 'Banco Caja Social', nit: '860.007.335-4' },
      { nombre: 'Nequi', nit: '890.903.938-8' },
      { nombre: 'Daviplata', nit: '860.034.313-7' },
      { nombre: 'Nu Colombia', nit: '901.408.835-2' },
      { nombre: 'Lulo Bank', nit: '901.323.004-9' },
    ];

    for (const b of bancosColombia) {
      const exists = await this.bancosRepository.findOne({ where: { nombre: b.nombre } });
      if (!exists) {
        await this.bancosRepository.save(this.bancosRepository.create(b));
      }
    }
  }
}
