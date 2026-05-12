import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';
import { DataSource, Repository } from 'typeorm';
import { PLAN_CUENTAS_MINIMO } from 'src/common/constants/plan-cuentas.constants';
import { CuentaContable, NaturalezaCuenta } from './entities/cuenta.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { AsientoDetalle } from 'src/asientos-contables/entities/asientos-detalles.entity';
import { FilterCuentaDto } from './dto/filter-cuenta.dto';

@Injectable()
export class CuentasService {

  constructor(
    @InjectRepository(CuentaContable)
    private readonly cuentaRepository: Repository<CuentaContable>,
    @InjectRepository(AsientoDetalle)
    private readonly asientoDetalleRepository: Repository<AsientoDetalle>,
  ) { }

  async findAll(filterDto?: FilterCuentaDto) {
    const { search, tipo, fechaInicio, fechaFin } = filterDto || {};
    

    const query = this.cuentaRepository.createQueryBuilder('cuenta')
      .leftJoinAndSelect('cuenta.cuentaPadre', 'cuentaPadre')
      .leftJoin(AsientoDetalle, 'detalle', 
        'detalle.cuentaId = cuenta.id' + 
        (fechaInicio && fechaFin ? ' AND detalle.createdAt BETWEEN :fechaInicio AND :fechaFin' : ''),
        { fechaInicio: fechaInicio, fechaFin: fechaFin }
      )
      .select([
        'cuenta.id',
        'cuenta.codigo',
        'cuenta.nombre',
        'cuenta.descripcion',
        'cuenta.tipo',
        'cuenta.naturaleza',
        'cuenta.nivel',
        'cuenta.aceptaMovimiento',
        'cuenta.isActive',
        'cuenta.isSystemAccount',
        'cuenta.cuentaPadreId',
      ])
      .addSelect('SUM(COALESCE(detalle.debito, 0))', 'totalDebito')
      .addSelect('SUM(COALESCE(detalle.credito, 0))', 'totalCredito')
      .groupBy('cuenta.id')
      .addGroupBy('cuentaPadre.id')
      .orderBy('cuenta.codigo', 'ASC');

    if (search) {
      query.andWhere('(cuenta.codigo LIKE :search OR cuenta.nombre LIKE :search)', { search: `%${search}%` });
    }

    if (tipo) {
      query.andWhere('cuenta.tipo = :tipo', { tipo });
    }

    const rawResults = await query.getRawAndEntities();
    const accounts = rawResults.entities;
    const rawData = rawResults.raw;

    // Create a map for quick access
    const accountMap = new Map<string, any>();

    accounts.forEach((acc, index) => {
      const raw = rawData[index];
      const totalDebito = parseFloat(raw.totalDebito || '0');
      const totalCredito = parseFloat(raw.totalCredito || '0');

      let saldo = 0;
      if (acc.naturaleza === NaturalezaCuenta.DEBITO) {
        saldo = totalDebito - totalCredito;
      } else {
        saldo = totalCredito - totalDebito;
      }

      accountMap.set(acc.id, {
        ...acc,
        totalDebito,
        totalCredito,
        saldoPropio: saldo,
        saldo: saldo, // Initial saldo will be updated for parents
      });
    });

    // Calculate aggregate balances for parent accounts
    const sortedByLevel = Array.from(accountMap.values()).sort((a, b) => b.nivel - a.nivel);

    sortedByLevel.forEach(acc => {
      if (acc.cuentaPadreId && accountMap.has(acc.cuentaPadreId)) {
        const parent = accountMap.get(acc.cuentaPadreId);
        parent.saldo += acc.saldo;
      }
    });

    return Array.from(accountMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  async create(createCuentaDto: CreateCuentaDto) {
    const { codigo } = createCuentaDto;

    // Determine parent code based on standard PUC lengths
    let parentCode = '';
    if (codigo.length === 2) parentCode = codigo.substring(0, 1);
    else if (codigo.length === 4) parentCode = codigo.substring(0, 2);
    else if (codigo.length > 4) parentCode = codigo.substring(0, codigo.length - 2);

    if (!parentCode) {
      throw new BadRequestException('Solo se permite agregar subcuentas de cuentas existentes (nivel 2 o superior)');
    }

    const parent = await this.cuentaRepository.findOne({ where: { codigo: parentCode } });
    if (!parent) {
      throw new NotFoundException(`La cuenta padre con código ${parentCode} no existe`);
    }

    // Auto-calculate hierarchy properties
    const nivel = parent.nivel + 1;
    const tipo = parent.tipo;
    const naturaleza = parent.naturaleza;

    const newCuenta = this.cuentaRepository.create({
      ...createCuentaDto,
      nivel,
      tipo,
      naturaleza,
      cuentaPadre: parent,
      isSystemAccount: false,
    });

    return this.cuentaRepository.save(newCuenta);
  }

  async update(id: string, updateCuentaDto: UpdateCuentaDto) {
    const cuenta = await this.cuentaRepository.findOne({ where: { id } });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

    // Rule: System accounts cannot be edited (except maybe isActive/aceptaMovimiento if needed, 
    // but user said "edicion solo va a hacer permitida para Cuentas que no este asociada a movimientos... Ej: Banco, Caja")
    if (cuenta.isSystemAccount) {
      throw new BadRequestException('No se permite editar esta cuenta porque es una cuenta protegida del sistema');
    }

    // Only allow updating non-structural fields
    const { nombre, descripcion, isActive, aceptaMovimiento } = updateCuentaDto;
    
    Object.assign(cuenta, {
      nombre: nombre ?? cuenta.nombre,
      descripcion: descripcion ?? cuenta.descripcion,
      isActive: isActive !== undefined ? isActive : cuenta.isActive,
      aceptaMovimiento: aceptaMovimiento !== undefined ? aceptaMovimiento : cuenta.aceptaMovimiento,
    });

    return this.cuentaRepository.save(cuenta);
  }

  async seedCuentasBasicasSincronizacion(dataSource: DataSource) {
    const repository = dataSource.getRepository(CuentaContable);

    console.log('📊 Sincronizando plan de cuentas básico...');

    const cuentasMap = new Map<string, CuentaContable>();

    // 1️⃣ Sincronizar clases (Nivel 1)
    const clasesData = PLAN_CUENTAS_MINIMO.filter(c => c.nivel > 1);
    for (const data of PLAN_CUENTAS_MINIMO) {
      let cuenta = await repository.findOne({ where: { codigo: data.codigo } });
      
      if (cuenta) {
        // Actualizar si existe (especialmente aceptaMovimiento)
        await repository.update({ id: cuenta.id }, { 
          aceptaMovimiento: data.aceptaMovimiento,
          nombre: data.nombre,
          nivel: data.nivel,
          isSystemAccount: true
        });
        cuenta = await repository.findOne({ where: { id: cuenta.id } });
      } else {
        cuenta = repository.create({ ...data, isSystemAccount: true });
        await repository.save(cuenta);
      }
      cuentasMap.set(data.codigo, cuenta!);
    }

    // 2️⃣ Sincronizar grupos e hijas (Nivel > 1)
    const hijasData = PLAN_CUENTAS_MINIMO.filter(c => c.nivel > 1);
    for (const data of hijasData) {
      const { cuentaPadreId, ...rest } = data;
      let cuenta = await repository.findOne({ where: { codigo: data.codigo } });

      if (cuenta) {
        // Actualizar valores clave
        await repository.update({ id: cuenta.id }, { 
          aceptaMovimiento: data.aceptaMovimiento,
          nombre: data.nombre,
          descripcion: data.descripcion,
          isSystemAccount: true 
        });
      } else {
        cuenta = repository.create({
          ...rest,
          cuentaPadre: cuentasMap.get(cuentaPadreId!),
          isSystemAccount: true
        });
        await repository.save(cuenta);
      }
      cuentasMap.set(data.codigo, cuenta!);
    }

    console.log('✅ Plan de cuentas básico sincronizado');
  }

  async seedCuentasBasicas(dataSource: DataSource) {
    const repository = dataSource.getRepository(CuentaContable);

    // Verificar si ya existen
    const count = await repository.count();
    if (count > 0) {
      console.log('⏭️  Cuentas ya existen, saltando seed');
      return;
    }

    console.log('📊 Creando plan de cuentas básico...');

    const cuentasMap = new Map<string, CuentaContable>();

    // 1️⃣ Crear primero las cuentas padre
    for (const data of PLAN_CUENTAS_MINIMO.filter(c => c.nivel === 1)) {
      const cuenta = repository.create({ ...data, isSystemAccount: true });
      await repository.save(cuenta);
      cuentasMap.set(data.codigo, cuenta);
    }

    // 2️⃣ Crear las cuentas hijas
    for (const data of PLAN_CUENTAS_MINIMO.filter(c => c.nivel > 1)) {
      const { cuentaPadreId, ...rest } = data;

      const cuenta = repository.create({
        ...rest,
        cuentaPadre: cuentasMap.get(cuentaPadreId!),
        isSystemAccount: true
      });

      await repository.save(cuenta);
    }

    console.log('✅ Plan de cuentas básico creado (14 cuentas)');
  }
}
