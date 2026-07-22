import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresaService implements OnModuleInit {
  private readonly logger = new Logger(EmpresaService.name);

  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepository: Repository<Empresa>,
  ) {}

  async onModuleInit() {
    const defaultEmpresa = await this.ensureDefaultCompany();
    if (defaultEmpresa) {
      await this.backfillOrphanedRecords(defaultEmpresa.id);
    }
  }

  private async ensureDefaultCompany(): Promise<Empresa> {
    try {
      let empresa = await this.empresaRepository.findOne({ where: {} });
      if (!empresa) {
        this.logger.log('No se encontró ninguna empresa en la base de datos. Creando empresa por defecto...');
        empresa = this.empresaRepository.create({
          nit: '900.123.456-7',
          razonSocial: 'ALVA Software Contable',
          direccion: 'Calle Falsa 123',
          telefono: '555-0199',
          email: 'contacto@alvasoft.com',
          configuracionDian: {},
        });
        empresa = await this.empresaRepository.save(empresa);
        this.logger.log(`Empresa por defecto creada con ID: ${empresa.id}`);
      }
      return empresa;
    } catch (error) {
      this.logger.error(`Error inicializando empresa por defecto: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async backfillOrphanedRecords(empresaId: string): Promise<void> {
    const tables = [
      'users',
      'asientos_contables',
      'facturas_venta',
      'facturas_compras',
      'cuentas_contables',
      'cuentas_bancarias',
      'clientes',
      'proveedores',
      'articulos',
      'pagos',
      'empleados',
      'activos_fijos',
      'impuestos',
      'categorias_articulos',
      'comprobantes_contables',
      'periodos_nomina',
      'notas_ajuste',
      'notas_ajuste_compras',
    ];

    for (const table of tables) {
      try {
        await this.empresaRepository.query(
          `UPDATE "${table}" SET "empresaId" = $1 WHERE "empresaId" IS NULL`,
          [empresaId],
        );
      } catch (err) {
        // Table or column might not exist yet if TypeORM hasn't synced it, ignore safely
        this.logger.warn(`Backfill para la tabla ${table} finalizó con aviso: ${err.message}`);
      }
    }
  }

  async getEmpresa() {
    try {
      const empresa = await this.empresaRepository.findOne({ where: {} });
      if (!empresa) {
        return this.ensureDefaultCompany();
      }
      return { success: true, data: empresa };
    } catch (error) {
      this.logger.error(`Error obteniendo empresa: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }

  async getEmpresaEntity(): Promise<Empresa> {
    const empresa = await this.empresaRepository.findOne({ where: {} });
    if (!empresa) {
      return this.ensureDefaultCompany();
    }
    return empresa;
  }

  async update(updateEmpresaDto: UpdateEmpresaDto) {
    try {
      let empresa = await this.empresaRepository.findOne({ where: {} });
      if (!empresa) {
        empresa = await this.ensureDefaultCompany();
      }
      this.empresaRepository.merge(empresa, updateEmpresaDto);
      const saved = await this.empresaRepository.save(empresa);
      return { success: true, data: saved, message: 'Información de la empresa actualizada correctamente' };
    } catch (error) {
      this.logger.error(`Error actualizando empresa: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }
}
