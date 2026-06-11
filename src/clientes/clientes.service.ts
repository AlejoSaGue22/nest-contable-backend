import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { Repository } from 'typeorm';
import { validate as isUUID } from 'uuid';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { TipoDocumento } from 'src/core/catalogs/entities/tipo-documento.entity';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clientesRepository: Repository<Cliente>,
    @InjectRepository(TipoDocumento)
    private readonly tipoDocumentoRepo: Repository<TipoDocumento>
  ) { }

  async create(createClienteDto: CreateClienteDto) {
    const cliente = this.clientesRepository.create(createClienteDto);
    const saved = await this.clientesRepository.save(cliente);
    return this.findOne(saved.id);
  }

  async findAll(paginationDto: PaginatioDto) {

    const page = paginationDto.offset || 1;
    const limit = paginationDto.limit || 10;
    const offset = (page - 1) * limit;
    const { search } = paginationDto;

    const queryBuilder = this.clientesRepository.createQueryBuilder('cliente');

    if (search) {
      queryBuilder.andWhere('cliente.nombre LIKE :search', {
        search: `%${search}%`
      });
    }

    queryBuilder.take(limit);
    queryBuilder.skip(offset);
    queryBuilder.orderBy('cliente.id', 'DESC');
    queryBuilder.leftJoinAndSelect('cliente.tipoDocumentoRel', 'tipoDocumentoRel');
    queryBuilder.leftJoinAndSelect('cliente.ciudadRel', 'ciudadRel');

    const clientes = await queryBuilder.getMany();
    const totalClients = await queryBuilder.getCount();

    const clientesMap = clientes.map((cli, indx) => {
      return {
          ...cli,
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
        ciudadRel: true
      }
    });

    if (!cliente) {
      throw new BadRequestException('Cliente no encontrado');
    }
    return cliente;
  }

  async update(id: string, updateClienteDto: UpdateClienteDto) {
    await this.findOne(id);
    const update = await this.clientesRepository.update(id, updateClienteDto);

    return update;
  }

  async remove(id: string) {
    await this.findOne(id);
    return await this.clientesRepository.softDelete({ id });
  }

}
