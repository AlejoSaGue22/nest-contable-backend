import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Impuesto } from './entities/impuesto.entity';
import { CreateImpuestoDto } from './dto/create-impuesto.dto';
import { UpdateImpuestoDto } from './dto/update-impuesto.dto';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';

@Injectable()
export class ImpuestosService {
  private readonly logger = new Logger(ImpuestosService.name);

  constructor(
    @InjectRepository(Impuesto)
    private readonly impuestoRepository: Repository<Impuesto>,
  ) { }

  async create(createImpuestoDto: CreateImpuestoDto) {
    try {
      const impuesto = this.impuestoRepository.create(createImpuestoDto);
      const saved = await this.impuestoRepository.save(impuesto);
      return { success: true, data: saved, message: 'Impuesto creado correctamente' };
    } catch (error) {
      this.logger.error(`Error creando impuesto: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.nombre = ILike(`%${search}%`);
    }

    const [data, total] = await this.impuestoRepository.findAndCount({
      where,
      relations: ['cuentaVentas', 'cuentaCompras', 'cuentaDevVentas', 'cuentaDevCompras'],
      order: { nombre: 'ASC' },
      skip,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Impuesto> {
    const impuesto = await this.impuestoRepository.findOne({
      where: { id },
      relations: ['cuentaVentas', 'cuentaCompras', 'cuentaDevVentas', 'cuentaDevCompras']
    });

    if (!impuesto) {
      throw new NotFoundException(`Impuesto con ID ${id} no encontrado`);
    }

    return impuesto;
  }

  async update(id: string, updateImpuestoDto: UpdateImpuestoDto) {
    try {
      await this.findOne(id); // Check existence
      await this.impuestoRepository.update(id, updateImpuestoDto);
      const updated = await this.findOne(id);

      return { success: true, data: updated, message: 'Impuesto actualizado correctamente' };
    } catch (error) {
      this.logger.error(`Error actualizando impuesto: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const impuesto = await this.findOne(id);
      await this.impuestoRepository.remove(impuesto);
      return { success: true, message: 'Impuesto eliminado correctamente' };
    } catch (error) {
      this.logger.error(`Error eliminando impuesto: ${error.message}`, error.stack);
      throw error;
    }
  }

  async seedDefaultTaxes(): Promise<void> {
    const count = await this.impuestoRepository.count();
    if (count > 0) {
      console.log('⏭️  Impuestos predeterminados ya existen, saltando seed');
      return;
    }

    console.log('📊 Creando impuestos predeterminados...');

    // Obtener las cuentas contables necesarias para el mapeo
    const entityManager = this.impuestoRepository.manager;

    // Buscamos las cuentas por su código
    const cuentaIva = await entityManager.findOne(CuentaContable, { where: { codigo: '2408' } });
    const cuentaAnticipo = await entityManager.findOne(CuentaContable, { where: { codigo: '1355' } });
    const cuentaReteFuente = await entityManager.findOne(CuentaContable, { where: { codigo: '2370' } });

    const defaultTaxes = [
      {
        nombre: 'IVA 19%',
        tipo: 'IVA',
        tarifa: 19,
        descripcion: 'Impuesto sobre las Ventas del 19% aplicable a nivel nacional',
        activo: true,
        cuentaVentasId: cuentaIva?.id || undefined,
        cuentaComprasId: cuentaIva?.id || cuentaAnticipo?.id || undefined,
        cuentaDevVentasId: cuentaIva?.id || undefined,
        cuentaDevComprasId: cuentaIva?.id || cuentaAnticipo?.id || undefined,
      },
      {
        nombre: 'IVA 5%',
        tipo: 'IVA',
        tarifa: 5,
        descripcion: 'Impuesto sobre las Ventas del 5% para bienes y servicios específicos',
        activo: true,
        cuentaVentasId: cuentaIva?.id || undefined,
        cuentaComprasId: cuentaIva?.id || cuentaAnticipo?.id || undefined,
        cuentaDevVentasId: cuentaIva?.id || undefined,
        cuentaDevComprasId: cuentaIva?.id || cuentaAnticipo?.id || undefined,
      },
      {
        nombre: 'IVA Exento 0%',
        tipo: 'IVA',
        tarifa: 0,
        descripcion: 'Bienes y servicios exentos de IVA',
        activo: true,
        cuentaVentasId: cuentaIva?.id || undefined,
        cuentaComprasId: cuentaIva?.id || cuentaAnticipo?.id || undefined,
        cuentaDevVentasId: cuentaIva?.id || undefined,
        cuentaDevComprasId: cuentaIva?.id || cuentaAnticipo?.id || undefined,
      },
      // {
      //   nombre: 'Retención en la Fuente 2.5%',
      //   tipo: 'Retencion',
      //   tarifa: 2.5,
      //   descripcion: 'Retención en la fuente del 2.5% por compras generales (declarantes)',
      //   activo: true,
      //   cuentaVentasId: cuentaAnticipo?.id || undefined, // Anticipo en la fuente (activo)
      //   cuentaComprasId: cuentaReteFuente?.id || undefined, // Retención por pagar (pasivo)
      //   cuentaDevVentasId: cuentaAnticipo?.id || undefined,
      //   cuentaDevComprasId: cuentaReteFuente?.id || undefined,
      // },
      // {
      //   nombre: 'Retención en la Fuente 3.5%',
      //   tipo: 'Retencion',
      //   tarifa: 3.5,
      //   descripcion: 'Retención en la fuente del 3.5% por compras generales (no declarantes)',
      //   activo: true,
      //   cuentaVentasId: cuentaAnticipo?.id || undefined,
      //   cuentaComprasId: cuentaReteFuente?.id || undefined,
      //   cuentaDevVentasId: cuentaAnticipo?.id || undefined,
      //   cuentaDevComprasId: cuentaReteFuente?.id || undefined,
      // },
      // {
      //   nombre: 'Retención en la Fuente 4% (Servicios)',
      //   tipo: 'Retencion',
      //   tarifa: 4,
      //   descripcion: 'Retención en la fuente del 4% por prestación de servicios (declarantes)',
      //   activo: true,
      //   cuentaVentasId: cuentaAnticipo?.id || undefined,
      //   cuentaComprasId: cuentaReteFuente?.id || undefined,
      //   cuentaDevVentasId: cuentaAnticipo?.id || undefined,
      //   cuentaDevComprasId: cuentaReteFuente?.id || undefined,
      // }
    ];

    for (const tax of defaultTaxes) {
      const nuevoImpuesto = this.impuestoRepository.create(tax);
      await this.impuestoRepository.save(nuevoImpuesto);
    }
    console.log('✅ Impuestos predeterminados creados exitosamente');
  }
}
