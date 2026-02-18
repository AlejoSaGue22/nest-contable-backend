import { Injectable } from '@nestjs/common';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';
import { DataSource } from 'typeorm';
import { PLAN_CUENTAS_MINIMO } from 'src/common/constants/plan-cuentas.constants';
import { CuentaContable } from './entities/cuenta.entity';

@Injectable()
export class CuentasService {


  create(createCuentaDto: CreateCuentaDto) {
    return 'This action adds a new cuenta';
  }

  findAll() {
    return `This action returns all cuentas`;
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
    for (const data of PLAN_CUENTAS_MINIMO.filter(c => c.nivel === 1 && c.nombre === 'PATRIMONIO')) {
      const cuenta = repository.create(data);
      await repository.save(cuenta);
      cuentasMap.set(data.codigo, cuenta);
    }

    // 2️⃣ Crear las cuentas hijas
    for (const data of PLAN_CUENTAS_MINIMO.filter(c => c.nivel > 1 && c.nombre === 'INGRESOS')) {
      const { cuentaPadreId, ...rest } = data;

      const cuenta = repository.create({
        ...rest,
        cuentaPadre: cuentasMap.get(cuentaPadreId!),
      });

      await repository.save(cuenta);
    }

    console.log('✅ Plan de cuentas básico creado (14 cuentas)');
  }
}
