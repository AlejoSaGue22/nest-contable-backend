import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Articulo } from './entities/articulos.entity';
import { Repository } from 'typeorm';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { CreateArticuloDto } from './dto/create-articulos.dto';
import { UpdateArticuloDto } from './dto/update-articulos.dto';
import { CATEGORIAS_ARTICULOS } from 'src/common/constants/categorias-articulos.config';
import { InternalServerErrorException } from '@nestjs/common';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { UnidadMedida } from 'src/catalogs/entities/unidad-medida.entity';

@Injectable()
export class ArticulosService {
  constructor(
    @InjectRepository(Articulo)
    private readonly articulosRepository: Repository<Articulo>,

    @InjectRepository(UnidadMedida)
    private readonly unidadesRepository: Repository<UnidadMedida>,

    @InjectRepository(CuentaContable)
    private readonly cuentasRepository: Repository<CuentaContable>
  ) { }

  async createConCuentas(createArticuloDto: CreateArticuloDto, userId: string) {
    const categoria = CATEGORIAS_ARTICULOS[createArticuloDto.categoria];

    if (!categoria) {
      throw new BadRequestException('Categoría inválida');
    }

    const unidadmedida = await this.unidadesRepository.findOne({
      where: { id: createArticuloDto.unidadmedida }
    });

    if (!unidadmedida) {
      throw new BadRequestException('Unidad de medida no encontrada');
    }

    // Buscar cuentas por código
    const cuentaContable = await this.cuentasRepository.findOne({
      where: { codigo: categoria.cuentaContableCodigo }
    });

    const cuentaIva = await this.cuentasRepository.findOne({
      where: { codigo: categoria.cuentaIvaCodigo }
    });

    if (!cuentaContable || !cuentaIva) {
      throw new InternalServerErrorException(
        'No se encontraron las cuentas contables configuradas'
      );
    }

    if (!createArticuloDto.codigo) {
      const codigo = await this.generateCodigo(categoria.tipo);
      createArticuloDto.codigo = codigo;
    }

    // Crear artículo con cuentas automáticas
    const articulo = this.articulosRepository.create({
      ...createArticuloDto,
      tipo: categoria.tipo,
      tipoCodigo: categoria.codigo,
      fullNameTipo: categoria.nombre,
      cuentaContableId: cuentaContable.id,
      unidadmedida: unidadmedida.id,
      unidadmedidaRel: unidadmedida,
      cuentaIvaId: cuentaIva.id,
      createdById: userId
    });

    return await this.articulosRepository.save(articulo);
  }

  async findAll(options: PaginatioDto) {
    const { limit = 10, offset = 0, venta_compra } = options;

    const queryBuilder = this.articulosRepository.createQueryBuilder('articulo');
    queryBuilder.leftJoinAndSelect('articulo.unidadmedidaRel', 'unidadmedidaRel');
    queryBuilder.leftJoinAndSelect('articulo.cuentaContable', 'cuentaContable');
    queryBuilder.leftJoinAndSelect('articulo.cuentaIva', 'cuentaIva');

    if (venta_compra) {
      queryBuilder.andWhere('articulo.tipo = :tipo', { tipo: venta_compra });
    }

    const articulos = await queryBuilder.getMany();
    const totalArticulos = await this.articulosRepository.count();

    const articulosMap = articulos.map((cli, indx) => {
      return {
        ...cli,
        iva_percent: cli.impuesto + '%',
        rete_percent: cli.retencion + '%',
        unidadmedida: cli.unidadmedidaRel.id.toString(),
        estado: cli.isActive == true ? 'Activo' : 'Inactivo',
        ind: (indx + 1).toString()
      }
    });

    return {
      count: totalArticulos,
      pages: Math.ceil(totalArticulos / limit),
      articulos: articulosMap
    }
  }

  async findAllV2(options: PaginatioDto) {
    const { limit = 10, offset = 0 } = options;

    const articulos = await this.articulosRepository.find({
      take: limit,
      skip: offset
    });

    const totalArticulos = await this.articulosRepository.count();

    const articulosMap = articulos.map((cli, indx) => {
      return {
        ...cli,
        iva_percent: cli.impuesto + '%',
        rete_percent: cli.retencion + '%',
        estado: cli.isActive == true ? 'Activo' : 'Inactivo',
        ind: (indx + 1).toString()
      }
    });

    return {
      count: totalArticulos,
      pages: Math.ceil(totalArticulos / limit),
      articulos: articulosMap
    }
  }

  async findOne(id: string) {
    const articulo = await this.articulosRepository.findOneBy({ id })

    if (!articulo) {
      throw new BadRequestException('Articulo no encontrado');
    }

    const articuloMap = {
      ...articulo,
      unidadmedida: articulo.unidadmedida.toString(),
    }

    return articuloMap;
  }

  async update(id: string, updateArticuloDto: UpdateArticuloDto) {
    const articulo = await this.findOne(id);

    if (updateArticuloDto.categoria && updateArticuloDto.categoria !== articulo.tipoCodigo) {
      const categoria = CATEGORIAS_ARTICULOS[updateArticuloDto.categoria];

      if (!categoria) {
        throw new BadRequestException('Categoría inválida');
      }

      const cuentaContable = await this.cuentasRepository.findOne({
        where: { codigo: categoria.cuentaContableCodigo }
      });

      const cuentaIva = await this.cuentasRepository.findOne({
        where: { codigo: categoria.cuentaIvaCodigo }
      });

      if (!cuentaContable || !cuentaIva) {
        throw new InternalServerErrorException(
          'No se encontraron las cuentas contables configuradas'
        );
      }

      articulo.tipo = categoria.tipo;
      articulo.tipoCodigo = categoria.codigo;
      articulo.fullNameTipo = categoria.nombre;
      articulo.cuentaContableId = cuentaContable.id;
      articulo.cuentaIvaId = cuentaIva.id;
    }

    const updatedArticulo = this.articulosRepository.merge(articulo, updateArticuloDto);
    return await this.articulosRepository.save(updatedArticulo);
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.articulosRepository.softDelete({ id });
  }

  async generateCodigo(tipo: 'venta' | 'compra' | 'gasto'): Promise<string> {
      const lastArticulo = await this.articulosRepository.find({
        order: { createdAt: 'DESC' },
        take: 1,  
      });

      console.log(lastArticulo);

      const lastNumber = lastArticulo.length > 0 ? (lastArticulo[0]).codigo as any || '0' : 0;
      const lastNumberSplit = lastNumber != '0' ? parseInt(lastNumber.split('-')[1]) : parseInt(lastNumber);
      const tipoArticulo = tipo === 'venta' ? 'V' : tipo === 'compra' ? 'C' : 'G';
      
      return `${tipoArticulo}-${(lastNumberSplit + 1).toString().padStart(6, '0')}`;
  }

}
