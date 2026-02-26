import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TipoDocumento } from './entities/tipo-documento.entity';
import { MetodoPago } from './entities/metodo-pago.entity';
import { CanalVenta } from './entities/canal-venta.entity';
import { UnidadMedida } from './entities/unidad-medida.entity';

@Injectable()
export class CatalogsService {
    private readonly logger = new Logger(CatalogsService.name);

    constructor(
        @InjectRepository(TipoDocumento)
        private tipoDocumentoRepo: Repository<TipoDocumento>,
        @InjectRepository(MetodoPago)
        private metodoPagoRepo: Repository<MetodoPago>,
        @InjectRepository(CanalVenta)
        private canalVentaRepo: Repository<CanalVenta>,
        @InjectRepository(UnidadMedida)
        private unidadMedidaRepo: Repository<UnidadMedida>,
    ) { }

    async findAllDocumentTypes() {
        return this.tipoDocumentoRepo.find();
    }

    async findAllPaymentMethods() {
        return this.metodoPagoRepo.find();
    }

    async findAllSalesChannels() {
        return this.canalVentaRepo.find();
    }

    async findAllUnitsMeasure() {
        return this.unidadMedidaRepo.find();
    }

    async seedAll() {
        await this.seedDocumentTypes();
        await this.seedPaymentMethods();
        await this.seedSalesChannels();
        await this.seedUnitsMeasure();
        this.logger.log('✅ Todos los catálogos han sido sincronizados');
    }

    private async seedDocumentTypes() {
        const data = [
            { codigo: '1', nombre: 'Registro civil' },
            { codigo: '2', nombre: 'Tarjeta de identidad' },
            { codigo: '3', nombre: 'Cédula de ciudadanía' },
            { codigo: '4', nombre: 'Tarjeta de extranjería' },
            { codigo: '5', nombre: 'Cédula de extranjería' },
            { codigo: '6', nombre: 'NIT' },
            { codigo: '7', nombre: 'Pasaporte' },
            { codigo: '8', nombre: 'Documento de identificación extranjero' },
            { codigo: '9', nombre: 'PEP' },
            { codigo: '10', nombre: 'NIT otro país' },
            { codigo: '11', nombre: 'NUIP' },
        ];

        for (const item of data) {
            const exists = await this.tipoDocumentoRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.tipoDocumentoRepo.save(item);
            }
        }
        this.logger.log('✔ Tipos de documento sincronizados');
    }

    private async seedPaymentMethods() {
        const data = [
            { codigo: '10', nombre: 'Efectivo' },
            { codigo: '42', nombre: 'Consignación' },
            { codigo: '20', nombre: 'Cheque' },
            { codigo: '47', nombre: 'Transferencia' },
            { codigo: '71', nombre: 'Bonos' },
            { codigo: '72', nombre: 'Vales' },
            { codigo: '1', nombre: 'Medio de pago no definido' },
            { codigo: '49', nombre: 'Tarjeta Débito' },
            { codigo: '48', nombre: 'Tarjeta Crédito' },
            { codigo: 'ZZZ', nombre: 'Otro' },
        ];

        for (const item of data) {
            const exists = await this.metodoPagoRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.metodoPagoRepo.save(item);
            }
        }
        this.logger.log('✔ Métodos de pago sincronizados');
    }

    private async seedSalesChannels() {
        const data = [
            { codigo: '1', nombre: 'Directo' },
            { codigo: '2', nombre: 'Online' },
            { codigo: '3', nombre: 'Distribuidor' },
            { codigo: '4', nombre: 'Retail' },
        ];

        for (const item of data) {
            const exists = await this.canalVentaRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.canalVentaRepo.save(item);
            }
        }
        this.logger.log('✔ Canales de venta sincronizados');
    }

    private async seedUnitsMeasure() {
        const data = [
            { codigo: '94', nombre: 'Unidad' },
            { codigo: '414', nombre: 'Kilogramo' },
            { codigo: '449', nombre: 'Libra' },
            { codigo: '512', nombre: 'Metro' },
            { codigo: '874', nombre: 'Galon' },
            { codigo: '111', nombre: 'Metro Cubico' },
            { codigo: '222', nombre: 'Pulgada' },
        ];

        for (const item of data) {
            const exists = await this.unidadMedidaRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.unidadMedidaRepo.save(item);
            }
        }
        this.logger.log('✔ Unidades de medida sincronizadas');
    }
}
