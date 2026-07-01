import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParametrizacionContable } from './entities/parametrizacion-contable.entity';

@Injectable()
export class ParametrizacionContableService {
    constructor(
        @InjectRepository(ParametrizacionContable)
        private readonly parametrizacionRepository: Repository<ParametrizacionContable>,
    ) { }

    async getConfiguracion(): Promise<ParametrizacionContable> {
        try {
            let config = await this.parametrizacionRepository.findOne({
                where: {},
            });

            // Si no existe, creamos un registro inicial vacío
            if (!config) {
                config = this.parametrizacionRepository.create();
                await this.parametrizacionRepository.save(config);
            }

            return config;
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener la configuración contable', error.message);
        }
    }

    async updateConfiguracion(data: Partial<ParametrizacionContable>): Promise<ParametrizacionContable> {
        try {
            let config = await this.getConfiguracion();

            // Actualizar campos
            if (data.cuentaCobrarClientesId !== undefined) config.cuentaCobrarClientesId = data.cuentaCobrarClientesId;
            if (data.cuentaDevolucionesClientesId !== undefined) config.cuentaDevolucionesClientesId = data.cuentaDevolucionesClientesId;
            if (data.cuentaPagarProveedoresId !== undefined) config.cuentaPagarProveedoresId = data.cuentaPagarProveedoresId;
            if (data.cuentaDevolucionesProveedoresId !== undefined) config.cuentaDevolucionesProveedoresId = data.cuentaDevolucionesProveedoresId;
            if (data.cuentaDevolucionIvaComprasId !== undefined) config.cuentaDevolucionIvaComprasId = data.cuentaDevolucionIvaComprasId;

            return await this.parametrizacionRepository.save(config);
        } catch (error) {
            throw new InternalServerErrorException('Error al actualizar la configuración contable', error.message);
        }
    }
}

