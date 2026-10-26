import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Proveedor } from './entities/proveedor.entity';
import { Brackets, Repository } from 'typeorm';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { TipoDocumento } from 'src/core/catalogs/entities/tipo-documento.entity';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';

const PROVIDER_SEARCH_TEXT = `TRANSLATE(LOWER(COALESCE(
  COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '') || CHR(1) ||
  COALESCE(p.razonSocial, '') || CHR(1) ||
  COALESCE(p.identificacion, '') || CHR(1) ||
  COALESCE(p.dv, '') || CHR(1) ||
  REGEXP_REPLACE(COALESCE(p.identificacion, ''), '[^0-9]', '', 'g') || CHR(1) ||
  COALESCE(p.email, '') || CHR(1) ||
  COALESCE(p.telefono, ''),
  ''
)), 'áéíóúüñ', 'aeiouun')`;

@Injectable()
export class ProveedoresService {
    constructor(
        @InjectRepository(Proveedor)
        private readonly proveedorRepository: Repository<Proveedor>,
        @InjectRepository(TipoDocumento)
        private readonly tipoDocumentoRepo: Repository<TipoDocumento>,
        private readonly parametrizacionService: ParametrizacionContableService,
    ) { }
    async create(createProveedorDto: CreateProveedorDto) {
        let { cuentaContableId, ...rest } = createProveedorDto;

        if (createProveedorDto.identificacion) {
            const proveedor = await this.proveedorRepository.findOne({
                where: {
                    identificacion: createProveedorDto.identificacion,
                    isActive: true
                }
            });
            if (proveedor) {
                throw new BadRequestException('El numero de documento ya se encuentra registrado');
            }
        }

        if (!cuentaContableId || cuentaContableId.trim() === '') {
            const config = await this.parametrizacionService.getConfiguracion();
            cuentaContableId = config?.cuentaPagarProveedoresId || undefined;
        }
        const proveedor = this.proveedorRepository.create({
            ...rest,
            cuentaContableId,
            isActive: true
        });
        const saved = await this.proveedorRepository.save(proveedor);
        const result = await this.findOne(saved.id);
        return result;
    }

    async findAll(paginationDto: PaginatioDto) {
        const page = paginationDto.offset || 1;
        const limit = paginationDto.limit || 10;
        const offset = (page - 1) * limit;
        const { search } = paginationDto;

        const qb = this.proveedorRepository
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.tipoDocumentoRel', 'tipoDocumentoRel')
            .leftJoinAndSelect('p.ciudadRel', 'ciudadRel')
            .leftJoinAndSelect('p.cuentaContable', 'cuentaContable')
            .orderBy('p.id', 'DESC')
            .take(limit)
            .skip(offset);

        if (search && search.trim().length > 0) {
            const normalizedSearch = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const term = `%${normalizedSearch}%`;
            qb.andWhere(new Brackets((searchQuery) => {
                searchQuery.where(`${PROVIDER_SEARCH_TEXT} LIKE :term`, { term });

                if (/^[\d\s.+()\-]+$/.test(search)) {
                    const digits = search.replace(/\D/g, '');
                    if (digits.length >= 3) {
                        searchQuery.orWhere(
                            `${PROVIDER_SEARCH_TEXT} LIKE :digitsTerm`,
                            { digitsTerm: `%${digits}%` },
                        );
                    }
                }
            }));
        }

        const [proveedores, totalProveedores] = await qb.getManyAndCount();

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
                ciudadRel: true,
                cuentaContable: true,
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
