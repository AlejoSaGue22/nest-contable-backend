import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Proveedor } from './entities/proveedor.entity';
import { Repository } from 'typeorm';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { TipoDocumento } from 'src/catalogs/entities/tipo-documento.entity';

@Injectable()
export class ProveedoresService {
    constructor(
        @InjectRepository(Proveedor)
        private readonly proveedorRepository: Repository<Proveedor>,
        @InjectRepository(TipoDocumento)
        private readonly tipoDocumentoRepo: Repository<TipoDocumento>
    ) { }

    create(createProveedorDto: CreateProveedorDto) {
        const { nombre, apellido, ...rest } = createProveedorDto;

        const proveedor = this.proveedorRepository.create({
            ...rest,
            nombre: `${nombre} ${apellido}`,
            isActive: true
        });

        return this.proveedorRepository.save(proveedor);
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
                fullName: prov.tipoPersona === 'PN' ? `${prov.nombre}` : prov.razonSocial,
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
        const proveedor = await this.proveedorRepository.findOne({ where: { id } });
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
