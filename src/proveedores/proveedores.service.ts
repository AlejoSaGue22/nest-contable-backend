import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Proveedor } from './entities/proveedor.entity';
import { Repository } from 'typeorm';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { TipoDocumento } from 'src/core/catalogs/entities/tipo-documento.entity';

@Injectable()
export class ProveedoresService {
    constructor(
        @InjectRepository(Proveedor)
        private readonly proveedorRepository: Repository<Proveedor>,
        @InjectRepository(TipoDocumento)
        private readonly tipoDocumentoRepo: Repository<TipoDocumento>
    ) { }
    async create(createProveedorDto: CreateProveedorDto) {
        const proveedor = this.proveedorRepository.create({
            ...createProveedorDto,
            isActive: true
        });
        const saved = await this.proveedorRepository.save(proveedor);
        const result = await this.findOne(saved.id);
        return result;
    }

    async findAll(options: PaginatioDto) {
        const { limit = 10, offset = 0 } = options;
        const proveedores = await this.proveedorRepository.find({
            take: limit,
            skip: offset,
            order: {
                id: 'DESC'
            },
            relations: {
                tipoDocumentoRel: true,
                ciudadRel: true
            }
        });

        const totalProveedores = await this.proveedorRepository.count();
        const proveedoresMap = proveedores.map((prov, indx) => {
            return {
                ...prov,
                fullName: prov.tipoPersona === 'PN' ? `${prov.nombre} ${prov.apellido}` : prov.razonSocial,
                estado: prov.isActive == true ? 'Activo' : 'Inactivo',
                ind: (indx + 1).toString()
            }
        });

        return {
            count: totalProveedores,
            pages: Math.ceil(totalProveedores / limit),
            proveedores: proveedoresMap
        };
    }

    async findOne(id: string) { 
        const proveedor = await this.proveedorRepository.findOne({
            where: { id },
            relations: {
                tipoDocumentoRel: true,
                ciudadRel: true
            }
        });
        if (!proveedor) {
            throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
        }
        return proveedor;
    }

    async update(id: string, updateProveedorDto: UpdateProveedorDto) {
        const proveedor = await this.findOne(id);
        this.proveedorRepository.merge(proveedor, updateProveedorDto);
        
        return this.proveedorRepository.save(proveedor);
    }

    async remove(id: string) {
        const proveedor = await this.findOne(id);
        return this.proveedorRepository.softRemove(proveedor);
    }
}
