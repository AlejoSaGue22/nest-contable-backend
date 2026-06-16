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
import { UnidadMedida } from 'src/core/catalogs/entities/unidad-medida.entity';
import { CategoriaArticulo } from 'src/core/catalogs/entities/categorias-articulos-entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';

@Injectable()
export class ArticulosService {
  constructor(
    @InjectRepository(Articulo)
    private readonly articulosRepository: Repository<Articulo>,

    @InjectRepository(UnidadMedida)
    private readonly unidadesRepository: Repository<UnidadMedida>,

    @InjectRepository(CuentaContable)
    private readonly cuentasRepository: Repository<CuentaContable>,

    @InjectRepository(CategoriaArticulo)
    private readonly categoriasRepository: Repository<CategoriaArticulo>,

    @InjectRepository(Impuesto)
    private readonly impuestosRepository: Repository<Impuesto>
  ) { }

  async createConCuentas(createArticuloDto: CreateArticuloDto, userId: string) {
    const categoria = await this.categoriasRepository.findOne({
      where: { id: createArticuloDto.categoria }  //cambiar para recibir el ID de la categoria
    });

    if (!categoria) {
      throw new BadRequestException('No existe la categoria especificada');
    }

    const unidadmedida = await this.unidadesRepository.findOne({
      where: { id: createArticuloDto.unidadmedida }
    });

    if (!unidadmedida) {
      throw new BadRequestException('No existe la unidad de medida especificada');
    }

    if (!createArticuloDto.codigo) {
      const codigo = await this.generateCodigo(categoria.tipo);
      createArticuloDto.codigo = codigo;
    }

    // Crear artículo con cuentas automáticas
    const articulo = this.articulosRepository.create({
      ...createArticuloDto,
      isInventariable: createArticuloDto.isInventariable ? createArticuloDto.isInventariable : true,
      tipo: categoria.tipo,
      impuestoId: createArticuloDto.impuesto,
      fullNameCategoria: categoria.nombre,
      precio: createArticuloDto.precio || 0,
      precioventa2: createArticuloDto.precioventa2 || 0,
      categoriaArticuloId: categoria.id,
      unidadmedida: unidadmedida.id,
      unidadmedidaRel: unidadmedida,
      createdById: userId
    });

    return await this.articulosRepository.save(articulo);
  }

  async findAll(options: PaginatioDto) {
    const { venta_compra, search } = options;

    const queryBuilder = this.articulosRepository.createQueryBuilder('articulo');
    queryBuilder.leftJoinAndSelect('articulo.unidadmedidaRel', 'unidadmedidaRel');
    queryBuilder.leftJoinAndSelect('articulo.impuestoRel', 'impuestoRe');
    queryBuilder.leftJoinAndSelect('articulo.categoriaArticulo', 'categoriaArticulo');

    if (venta_compra) {
      const tiposFiltro: Record<string, string[]> = {
        'costo': ['costo', 'gasto'],
        'venta': ['venta', 'servicio'],
      };

      const tiposAFiltrar = tiposFiltro[venta_compra];

      if (tiposAFiltrar) {
        queryBuilder.andWhere('articulo.tipo IN (:...tipos)', { tipos: tiposAFiltrar });
      } else {
        queryBuilder.andWhere('articulo.tipo = :tipo', { tipo: venta_compra });
      }
    }

    if (search) {
      queryBuilder.andWhere('articulo.nombre LIKE :search', {
        search: `%${search}%`
      });
    }

    const page = options.offset || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    queryBuilder.take(limit);
    queryBuilder.skip(offset);
    queryBuilder.orderBy('articulo.id', 'DESC');

    const articulos = await queryBuilder.getMany();
    const totalArticulos = await queryBuilder.getCount();

    const articulosMap = articulos.map((cli, indx) => {
      return {
        ...cli,
        iva_percent: cli.impuestoRel.tarifa + '%',
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
        iva_percent: cli.impuestoRel.tarifa + '%',
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

    if (updateArticuloDto.categoria && updateArticuloDto.categoria !== articulo.categoriaArticuloId) {
      const categoria = await this.categoriasRepository.findOne({
        where: { id: updateArticuloDto.categoria }
      });

      if (!categoria) {
        throw new BadRequestException('Categoría inválida');
      }

      articulo.tipo = categoria.tipo;
      articulo.fullNameCategoria = categoria.nombre;
    }

    if (updateArticuloDto.isInventariable !== undefined) {
      articulo.isInventariable = updateArticuloDto.isInventariable;
    }

    const updatedArticulo = this.articulosRepository.merge(articulo, updateArticuloDto);
    return await this.articulosRepository.save(updatedArticulo);
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.articulosRepository.softDelete({ id });
  }

  async generateCodigo(tipo: 'venta' | 'costo' | 'gasto' | 'servicio'): Promise<string> {
    const lastArticulo = await this.articulosRepository.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });

    console.log(lastArticulo);

    const lastNumber = lastArticulo.length > 0 ? (lastArticulo[0]).codigo as any || '0' : 0;
    const lastNumberSplit = lastNumber != '0' ? parseInt(lastNumber.split('-')[1]) : parseInt(lastNumber);
    const tipoArticulo = tipo === 'venta' ? 'V' : tipo === 'costo' ? 'C' : tipo === 'gasto' ? 'G' : 'S';

    return `${tipoArticulo}-${(lastNumberSplit + 1).toString().padStart(6, '0')}`;
  }

}
