import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Impuesto } from './entities/impuesto.entity';
import { CreateImpuestoDto } from './dto/create-impuesto.dto';
import { UpdateImpuestoDto } from './dto/update-impuesto.dto';

@Injectable()
export class ImpuestosService {
  constructor(
    @InjectRepository(Impuesto)
    private readonly impuestoRepository: Repository<Impuesto>,
  ) {}

  async create(createImpuestoDto: CreateImpuestoDto): Promise<Impuesto> {
    const impuesto = this.impuestoRepository.create(createImpuestoDto);
    return await this.impuestoRepository.save(impuesto);
  }

  async findAll(): Promise<Impuesto[]> {
    return await this.impuestoRepository.find({
      relations: ['cuentaVentas', 'cuentaCompras', 'cuentaDevVentas', 'cuentaDevCompras'],
      order: { nombre: 'ASC' }
    });
  }

  async findOne(id: string): Promise<Impuesto> {
    const impuesto = await this.impuestoRepository.findOne({
      where: { id },
      relations: ['cuentaVentas', 'cuentaCompras', 'cuentaDevVentas', 'cuentaDevCompras']
    });

    if (!impuesto) {
      throw new NotFoundException(`Impuesto con ID ${id} no encontrado`);
    }

    return impuesto;
  }

  async update(id: string, updateImpuestoDto: UpdateImpuestoDto): Promise<Impuesto> {
    const impuesto = await this.findOne(id);
    this.impuestoRepository.merge(impuesto, updateImpuestoDto);
    return await this.impuestoRepository.save(impuesto);
  }

  async remove(id: string): Promise<void> {
    const impuesto = await this.findOne(id);
    await this.impuestoRepository.remove(impuesto);
  }
}
