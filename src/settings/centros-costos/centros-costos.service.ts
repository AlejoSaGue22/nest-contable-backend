import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CentroCosto } from '../../../nomina/entities/centro-costo.entity';
import { CreateCentroCostoDto } from './dto/create-centro-costo.dto';
import { UpdateCentroCostoDto } from './dto/update-centro-costo.dto';

@Injectable()
export class CentrosCostosService {
    constructor(
        @InjectRepository(CentroCosto)
        private readonly centrosCostosRepository: Repository<CentroCosto>,
    ) {}

    async create(createCentroCostoDto: CreateCentroCostoDto) {
        try {
            const centroCosto = this.centrosCostosRepository.create(createCentroCostoDto);
            return await this.centrosCostosRepository.save(centroCosto);
        } catch (error) {
            if (error.code === '23505') {
                throw new ConflictException(`El centro de costo con código ${createCentroCostoDto.codigo} ya existe`);
            }
            throw error;
        }
    }

    findAll() {
        return this.centrosCostosRepository.find({
            order: { nombre: 'ASC' },
        });
    }

    async findOne(id: string) {
        const centroCosto = await this.centrosCostosRepository.findOne({ where: { id } });
        if (!centroCosto) {
            throw new NotFoundException(`Centro de costo con ID ${id} no encontrado`);
        }
        return centroCosto;
    }

    async update(id: string, updateCentroCostoDto: UpdateCentroCostoDto) {
        const centroCosto = await this.findOne(id);
        Object.assign(centroCosto, updateCentroCostoDto);

        try {
            return await this.centrosCostosRepository.save(centroCosto);
        } catch (error) {
            if (error.code === '23505') {
                throw new ConflictException(`El centro de costo con código ${updateCentroCostoDto.codigo} ya existe`);
            }
            throw error;
        }
    }

    async remove(id: string) {
        const centroCosto = await this.findOne(id);
        return this.centrosCostosRepository.remove(centroCosto);
    }
}
