import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCargoDto } from './dto/create-cargo.dto';
import { UpdateCargoDto } from './dto/update-cargo.dto';
import { Cargo } from 'src/nomina/entities/cargo.entity';

@Injectable()
export class CargosService {
  constructor(
    @InjectRepository(Cargo)
    private readonly cargosRepository: Repository<Cargo>,
  ) {}

  async create(createCargoDto: CreateCargoDto) {
    try {
      const cargo = this.cargosRepository.create(createCargoDto);
      return await this.cargosRepository.save(cargo);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `El cargo con código ${createCargoDto.codigo} ya existe`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.cargosRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string) {
    const cargo = await this.cargosRepository.findOne({ where: { id } });
    if (!cargo) {
      throw new NotFoundException(`Cargo con ID ${id} no encontrado`);
    }
    return cargo;
  }

  async update(id: string, updateCargoDto: UpdateCargoDto) {
    const cargo = await this.findOne(id);
    Object.assign(cargo, updateCargoDto);

    try {
      return await this.cargosRepository.save(cargo);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          `El cargo con código ${updateCargoDto.codigo} ya existe`,
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    const cargo = await this.findOne(id);
    return this.cargosRepository.remove(cargo);
  }
}
