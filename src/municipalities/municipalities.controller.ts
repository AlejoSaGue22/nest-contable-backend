import { Controller, Get, Post, Logger } from '@nestjs/common';
import { MunicipalitiesService } from './municipalities.service';

@Controller('municipalities')
export class MunicipalitiesController {
    private readonly logger = new Logger(MunicipalitiesController.name);

    constructor(private readonly municipalitiesService: MunicipalitiesService) { }

    @Get()
    async findAll() {
        return await this.municipalitiesService.findAll();
    }

    @Post('sync')
    async sync() {
        this.logger.log('Solicitud de sincronización manual de municipios recibida');
        return await this.municipalitiesService.syncMunicipalities();
    }
}
