import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Municipality } from './entities/municipality.entity';
import { FactusService } from 'src/api-dian/services/factus.service';

@Injectable()
export class MunicipalitiesService {
    private readonly logger = new Logger(MunicipalitiesService.name);

    constructor(
        @InjectRepository(Municipality)
        private readonly municipalityRepository: Repository<Municipality>,
        private readonly factusService: FactusService,
    ) { }

    async findAll(): Promise<Municipality[]> {
        return await this.municipalityRepository.find({
            order: { name: 'ASC' }
        });
    }

    async syncMunicipalities(): Promise<{ count: number }> {
        this.logger.log('🔄 Iniciando sincronización de municipios con Factus...');

        try {
            const externalMunicipalities = await this.factusService.obtenerMunicipios();

            if (!externalMunicipalities || externalMunicipalities.length === 0) {
                this.logger.warn('⚠️ No se recibieron municipios de la API externa');
                return { count: 0 };
            }

            // Mapear y guardar (upsert)
            const municipalitiesToSave = externalMunicipalities.map(m => ({
                id: m.id,
                code: m.code,
                name: m.name,
                department: m.department
            }));

            // Usar save para manejar upsert basado en el ID primario
            await this.municipalityRepository.save(municipalitiesToSave);

            this.logger.log(`✅ Sincronización completada. ${municipalitiesToSave.length} municipios actualizados.`);
            return { count: municipalitiesToSave.length };

        } catch (error) {
            this.logger.error('❌ Error sincronizando municipios:', error);
            throw error;
        }
    }

    async findOne(id: number): Promise<Municipality | null> {
        return await this.municipalityRepository.findOne({ where: { id } });
    }
}
