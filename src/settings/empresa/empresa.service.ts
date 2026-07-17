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
    await this.ensureDefaultCompany();
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
