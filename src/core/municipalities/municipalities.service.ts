import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Municipality } from './entities/municipality.entity';
import * as fs from 'fs';
import * as path from 'path';

interface MunicipalityJsonItem {
    code: string;
    name: string;
    department: {
        code: string;
        name: string;
    };
}

@Injectable()
export class MunicipalitiesService {
    private readonly logger = new Logger(MunicipalitiesService.name);

    constructor(
        @InjectRepository(Municipality)
        private readonly municipalityRepository: Repository<Municipality>,
    ) { }

    async findAll(): Promise<Municipality[]> {
        return await this.municipalityRepository.find({
            order: { name: 'ASC' }
        });
    }

    async hasIncompleteV2Data(): Promise<boolean> {
        const incompleteCount = await this.municipalityRepository
            .createQueryBuilder('municipality')
            .where('municipality.departmentCode IS NULL')
            .orWhere('municipality.departmentName IS NULL')
            .getCount();

        return incompleteCount > 0;
    }

    async syncMunicipalities(): Promise<{ count: number }> {
        this.logger.log('🔄 Iniciando carga local de municipios V2...');

        try {
            const filePath = path.join(process.cwd(), 'json-municipios.json');
            if (!fs.existsSync(filePath)) {
                throw new Error(`Archivo de municipios no encontrado: ${filePath}`);
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(content) as { municipalities?: MunicipalityJsonItem[] };
            const municipalities = parsed.municipalities || [];

            if (municipalities.length === 0) {
                this.logger.warn('⚠️ El archivo local no contiene municipios');
                return { count: 0 };
            }

            const municipalitiesToSave = municipalities.map(m => ({
                id: Number(m.code),
                code: m.code,
                name: m.name,
                department: m.department.name,
                departmentCode: m.department.code,
                departmentName: m.department.name,
            }));

            // Use createQueryBuilder to avoid updating 'id', which triggers FK violations if the record is referenced
            await this.municipalityRepository.createQueryBuilder()
                .insert()
                .into(Municipality)
                .values(municipalitiesToSave)
                .orUpdate(
                    ['name', 'department', 'departmentCode', 'departmentName'],
                    ['code']
                )
                .execute();

            this.logger.log(`✅ Carga local completada. ${municipalitiesToSave.length} municipios procesados.`);
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
