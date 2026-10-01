import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Vendedor } from './entities/vendedor.entity';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';

@Injectable()
export class VendedoresService {
  private readonly logger = new Logger(VendedoresService.name);

  constructor(
    @InjectRepository(Vendedor)
    private readonly vendedorRepository: Repository<Vendedor>,
  ) {}

  async create(createVendedorDto: CreateVendedorDto) {
    try {
      const vendedor = this.vendedorRepository.create(createVendedorDto);
      const saved = await this.vendedorRepository.save(vendedor);
      return { success: true, data: saved, message: 'Vendedor creado correctamente' };
    } catch (error) {
      this.logger.error(`Error creando vendedor: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.nombre = ILike(`%${search}%`);
    }

    const [data, total] = await this.vendedorRepository.findAndCount({
      where,
      order: { nombre: 'ASC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Vendedor> {
    const vendedor = await this.vendedorRepository.findOne({ where: { id } });

    if (!vendedor) {
      throw new NotFoundException(`Vendedor con ID ${id} no encontrado`);
    }

    return vendedor;
  }

  async update(id: string, updateVendedorDto: UpdateVendedorDto) {
    try {
      const vendedor = await this.findOne(id);
      this.vendedorRepository.merge(vendedor, updateVendedorDto);
      const saved = await this.vendedorRepository.save(vendedor);
      return { success: true, data: saved, message: 'Vendedor actualizado correctamente' };
    } catch (error) {
      this.logger.error(`Error actualizando vendedor: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const vendedor = await this.findOne(id);
      await this.vendedorRepository.softRemove(vendedor);
      return { success: true, message: 'Vendedor eliminado correctamente' };
    } catch (error) {
      this.logger.error(`Error eliminando vendedor: ${error.message}`, error.stack);
      throw error;
    }
  }
}
