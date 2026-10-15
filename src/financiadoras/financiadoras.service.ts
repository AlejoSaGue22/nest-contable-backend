import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFinanciadoraDto } from './dto/create-financiadora.dto';
import { UpdateFinanciadoraDto } from './dto/update-financiadora.dto';
import { Financiadora } from './entities/financiadora.entity';

@Injectable()
export class FinanciadorasService {
  constructor(
    @InjectRepository(Financiadora)
    private readonly repository: Repository<Financiadora>,
  ) {}

  async findAll(): Promise<Financiadora[]> {
    return this.repository.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  async create(dto: CreateFinanciadoraDto): Promise<Financiadora> {
    const nombre = dto.nombre.trim();
    const existing = await this.repository.findOne({ where: { nombre } });
    if (existing) throw new ConflictException('Ya existe una financiadora con ese nombre');

    return this.repository.save(this.repository.create({
      nombre,
      nit: dto.nit?.trim() || null,
    }));
  }

  async update(id: string, dto: UpdateFinanciadoraDto): Promise<Financiadora> {
    const financiadora = await this.repository.findOne({ where: { id } });
    if (!financiadora) throw new NotFoundException('Financiadora no encontrada');

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      const duplicate = await this.repository.findOne({ where: { nombre } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Ya existe una financiadora con ese nombre');
      }
      financiadora.nombre = nombre;
    }
    if (dto.nit !== undefined) financiadora.nit = dto.nit.trim() || null;
    return this.repository.save(financiadora);
  }

  async deactivate(id: string): Promise<void> {
    const financiadora = await this.repository.findOne({ where: { id } });
    if (!financiadora) throw new NotFoundException('Financiadora no encontrada');
    financiadora.activo = false;
    await this.repository.save(financiadora);
  }
}
