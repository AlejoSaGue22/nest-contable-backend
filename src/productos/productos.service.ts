import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Repository } from 'typeorm';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly productosRepository: Repository<Producto>
  ){}
  async create(createProductoDto: CreateProductoDto) {
    const producto = this.productosRepository.create(createProductoDto);

    return await this.productosRepository.save(producto);
  }

  async findAll(options: PaginatioDto) {
    const { limit = 10,  offset = 0 } = options;

    console.log("limit: ", limit)
    console.log("offset: ", offset)


    const product = await this.productosRepository.find({
        take: limit,
        skip: offset
    });

    console.log(product)

    const totalProductos = await this.productosRepository.count();

    const productMap = product.map((cli, indx) => {
        return {
          ...cli,
          iva_percent: cli.impuesto + '%',
          rete_percent: cli.retencion + '%',
          estado: cli.isActive == true ? 'Activo' : 'Inactivo',
          ind: (indx + 1).toString()
        }
    });

    return {
      count: totalProductos,
      pages: Math.ceil(totalProductos / limit),
      productos: productMap
    }
  }

  async findOne(id: string) {
    const producto = await this.productosRepository.findOneBy({id})
    
    if (!producto) {
        throw new BadRequestException('Producto no encontrado');
    }

    return producto;
  }

  async update(id: string, updateProductoDto: UpdateProductoDto) {
    await this.findOne(id);
    const update = await this.productosRepository.update(id, updateProductoDto);

    return update;

  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.productosRepository.softDelete({ id });
  }

}
