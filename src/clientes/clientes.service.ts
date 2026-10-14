import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { Brackets, Repository } from 'typeorm';
import { validate as isUUID } from 'uuid';
import { ClientesFilterDto } from './dto/clientes-filter.dto';
import { TipoDocumento } from 'src/core/catalogs/entities/tipo-documento.entity';
import { ParametrizacionContableService } from 'src/settings/parametrizacion-contable/parametrizacion-contable.service';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clientesRepository: Repository<Cliente>,
    @InjectRepository(TipoDocumento)
    private readonly tipoDocumentoRepo: Repository<TipoDocumento>,
    private readonly parametrizacionService: ParametrizacionContableService,
  ) { }

  async create(createClienteDto: CreateClienteDto) {
    let { cuentaContableId, ...rest } = createClienteDto;
    if (!cuentaContableId || cuentaContableId.trim() === '') {
      const config = await this.parametrizacionService.getConfiguracion();
      cuentaContableId = config?.cuentaCobrarClientesId || undefined;
    }
    const cliente = this.clientesRepository.create({
      ...rest,
      tributo: createClienteDto.tributo == 'S' ? 18 : 21,
      cuentaContableId,
    });
    const saved = await this.clientesRepository.save(cliente);
    return this.findOne(saved.id);
  }

  async findAll(paginationDto: ClientesFilterDto) {
    const offset = paginationDto.offset ?? 0;
    const limit = paginationDto.limit ?? 10;
    const search = paginationDto.search?.trim();
    const queryBuilder = this.clientesRepository.createQueryBuilder('cliente');

    if (search) {
      const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const term = `%${normalizedSearch}%`;
      const textColumns = [
        'cliente.nombre',
        'cliente.apellido',
        "CONCAT(COALESCE(cliente.nombre, ''), ' ', COALESCE(cliente.apellido, ''))",
        'cliente.razonSocial',
        'cliente.numeroDocumento',
        'cliente.dv',
        'tipoDocumentoRel.abreviatura',
      ];

      queryBuilder.andWhere(new Brackets((searchQuery) => {
        textColumns.forEach((column, index) => {
          const expression = `TRANSLATE(LOWER(COALESCE(${column}, '')), 'áéíóúüñ', 'aeiouun') LIKE :term`;
          if (index === 0) searchQuery.where(expression, { term });
          else searchQuery.orWhere(expression, { term });
        });

        if (/^[\d\s.+()\-]+$/.test(search)) {
          const digits = search.replace(/\D/g, '');
          if (digits.length >= 3) {
            const digitsTerm = `%${digits}%`;
            searchQuery
              .orWhere("REGEXP_REPLACE(COALESCE(cliente.numeroDocumento, ''), '[^0-9]', '', 'g') LIKE :digitsTerm", { digitsTerm });
          }
        }
      }));
    }

    if (paginationDto.estado) {
      queryBuilder.andWhere('cliente.isActive = :isActive', { isActive: paginationDto.estado === 'ACTIVO' });
    }

    queryBuilder.leftJoinAndSelect('cliente.tipoDocumentoRel', 'tipoDocumentoRel');
    queryBuilder.leftJoinAndSelect('cliente.ciudadRel', 'ciudadRel');
    queryBuilder.leftJoinAndSelect('cliente.cuentaContable', 'cuentaContable');
    queryBuilder.take(limit);
    queryBuilder.skip(offset);
    queryBuilder.orderBy('cliente.id', 'DESC');

    const clientes = await queryBuilder.getMany();
    const totalClients = await queryBuilder.getCount();

    const clientesMap = clientes.map((cli, indx) => {
      return {
        ...cli,
        tributo: cli.tributo === 18 ? 'S' : 'N',
        fullName: cli.razonSocial ? cli.razonSocial : `${cli.nombre} ${cli.apellido}`,
        tipoPersona_nom: cli.tipoPersona == 'PN' ? 'Persona Natural' : 'Persona Juridica',
        estado: cli.isActive == true ? 'Activo' : 'Inactivo',
        ind: (indx + 1).toString()
      }
    })

    return {
      count: totalClients,
      pages: Math.ceil(totalClients / limit),
      clientes: clientesMap
    };
  }

  async findOne(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Formato ID no valido');
    }

    const cliente = await this.clientesRepository.findOne({
      where: { id },
      relations: {
        tipoDocumentoRel: true,
        ciudadRel: true,
        cuentaContable: true,
      }
    });

    if (!cliente) {
      throw new BadRequestException('Cliente no encontrado');
    }
    return {
      ...cliente,
      tributo: cliente.tributo === 18 ? 'S' : 'N',
    } as any;
  }

  async update(id: string, updateClienteDto: UpdateClienteDto) {
    await this.findOne(id);

    const { tributo, ...rest } = updateClienteDto;

    const update = await this.clientesRepository.update(id, {
      ...rest,
      tributo: tributo == 'S' ? 18 : 21,
    });

    return update;
  }

  async remove(id: string) {
    await this.findOne(id);
    return await this.clientesRepository.softDelete({ id });
  }

}
