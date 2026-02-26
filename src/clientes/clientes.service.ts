import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { Repository } from 'typeorm';
import { validate as isUUID } from 'uuid';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { TipoDocumento } from 'src/catalogs/entities/tipo-documento.entity';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clientesRepository: Repository<Cliente>,
    @InjectRepository(TipoDocumento)
    private readonly tipoDocumentoRepo: Repository<TipoDocumento>
  ) { }

  async create(createClienteDto: CreateClienteDto) {
    const cliente = this.clientesRepository.create(createClienteDto)

    return await this.clientesRepository.save(cliente);
  }

  async findAll(options: PaginatioDto) {

    const { limit = 10, offset = 0 } = options;

    const clientes = await this.clientesRepository.find({
      take: limit,
      skip: offset,
      order: {
        id: 'DESC'
      }
    });

    const totalClients = await this.clientesRepository.count();
    const tiposDocumento = await this.findAllDocumentTypes();

    const clientesMap = clientes.map((cli, indx) => {
      return {
          ...cli,
          fullName: `${cli.nombre} ${cli.apellido}`,
          tipoDocumento_nom: tiposDocumento.find((td) => td.codigo === cli.tipoDocumento)?.abreviatura,
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

  async findAllDocumentTypes() {
    return this.tipoDocumentoRepo.find();
  }

  async findOne(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Formato ID no valido');
    }

    const cliente = await this.clientesRepository.findOne({
      where: { id }
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
