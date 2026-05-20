import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Impuesto } from './entities/impuesto.entity';
import { CreateImpuestoDto } from './dto/create-impuesto.dto';
import { UpdateImpuestoDto } from './dto/update-impuesto.dto';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';

@Injectable()
export class ImpuestosService {
  constructor(
    @InjectRepository(Impuesto)
    private readonly impuestoRepository: Repository<Impuesto>,
  ) {}

  async create(createImpuestoDto: CreateImpuestoDto): Promise<Impuesto> {
    const impuesto = this.impuestoRepository.create(createImpuestoDto);
    return await this.impuestoRepository.save(impuesto);
  }

  async findAll(): Promise<Impuesto[]> {
    return await this.impuestoRepository.find({
      relations: ['cuentaVentas', 'cuentaCompras', 'cuentaDevVentas', 'cuentaDevCompras'],
      order: { nombre: 'ASC' }
    });
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

  async update(id: string, updateImpuestoDto: UpdateImpuestoDto): Promise<Impuesto> {
    const impuesto = await this.findOne(id);
    this.impuestoRepository.merge(impuesto, updateImpuestoDto);
    return await this.impuestoRepository.save(impuesto);
  }

  async remove(id: string): Promise<void> {
    const impuesto = await this.findOne(id);
    await this.impuestoRepository.remove(impuesto);
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
