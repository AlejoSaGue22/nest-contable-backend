import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TipoDocumento } from './entities/tipo-documento.entity';
import { MetodoPago } from './entities/metodo-pago.entity';
import { CanalVenta } from './entities/canal-venta.entity';
import { UnidadMedida } from './entities/unidad-medida.entity';
import { CategoriaArticulo } from './entities/categorias-articulos-entity';
import { CATEGORIAS_ARTICULOS } from 'src/common/constants/categorias-articulos.config';

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
        @InjectRepository(CategoriaArticulo)
        private categoriasArticulosRepo: Repository<CategoriaArticulo>,
    ) { }

    async findAllDocumentTypes() {
        return this.tipoDocumentoRepo.find({ where: { state: true } });
    }

    async findAllPaymentMethods() {
        return this.metodoPagoRepo.find({ where: { state: true } });
    }

    async findAllSalesChannels() {
        return this.canalVentaRepo.find({ where: { state: true } });
    }

    async findAllUnitsMeasure() {
        return this.unidadMedidaRepo.find({ where: { state: true } });
    }

    async findAllCategoriesArticles() {
        const data = await this.categoriasArticulosRepo.find({ where: { state: true } });

        const data2 = data.map((item) => {
            return {
                codigo: item.codigo,
                nombre: item.nombre,
                tipo: item.tipo,
                descripcion: item.descripcion,
            };
        });
        return data2;
    }

    async seedAll() {
        await this.seedDocumentTypes();
        await this.seedPaymentMethods();
        await this.seedSalesChannels();
        await this.seedUnitsMeasure();
        await this.seedCategoriesArticles();
        this.logger.log('✅ Todos los catálogos han sido sincronizados');
    }

    private async seedDocumentTypes() {
        const data = [
            { id: '1', abreviatura: 'RC', nombre: 'Registro civil', state: true },
            { id: '2', abreviatura: 'TI', nombre: 'Tarjeta de identidad', state: true },
            { id: '3', abreviatura: 'CC', nombre: 'Cédula de ciudadanía', state: true },
            { id: '4', abreviatura: 'TE', nombre: 'Tarjeta de extranjería', state: true },
            { id: '5', abreviatura: 'CE', nombre: 'Cédula de extranjería', state: true },
            { id: '6', abreviatura: 'NIT', nombre: 'NIT', state: true },
            { id: '7', abreviatura: 'PAS', nombre: 'Pasaporte', state: true },
            { id: '8', abreviatura: 'DIE', nombre: 'Documento de identificación extranjero', state: true },
            { id: '9', abreviatura: 'PEP', nombre: 'PEP', state: true },
            { id: '10', abreviatura: 'NIT', nombre: 'NIT otro país', state: true },
            { id: '11', abreviatura: 'NUIP', nombre: 'NUIP', state: true },
        ];

        for (const item of data) {
            const exists = await this.tipoDocumentoRepo.findOne({ where: { id: item.id } });
            if (!exists) {
                await this.tipoDocumentoRepo.save(item);
            }
        }
        this.logger.log('✔ Tipos de documento sincronizados');
    }

    private async seedPaymentMethods() {
        const data = [
            { codigo: '10', nombre: 'Efectivo', state: true },
            { codigo: '42', nombre: 'Consignación', state: true },
            { codigo: '20', nombre: 'Cheque', state: true },
            { codigo: '47', nombre: 'Transferencia', state: true },
            { codigo: '71', nombre: 'Bonos', state: true },
            { codigo: '72', nombre: 'Vales', state: true },
            { codigo: '1', nombre: 'Medio de pago no definido', state: true },
            { codigo: '49', nombre: 'Tarjeta Débito', state: true },
            { codigo: '48', nombre: 'Tarjeta Crédito', state: true },
            { codigo: 'ZZZ', nombre: 'Otro', state: true },
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
            { id: '1', codigo: '1', nombre: 'Directo', state: true },
            { id: '2', codigo: '2', nombre: 'Online', state: true },
            { id: '3', codigo: '3', nombre: 'Distribuidor', state: true },
            { id: '4', codigo: '4', nombre: 'Retail', state: true },
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
            { id: '70', codigo: '94', nombre: 'Unidad', state: true },
            { id: '414', codigo: 'KGM', nombre: 'Kilogramo', state: true },
            { id: '449', codigo: 'LBR', nombre: 'Libra', state: true },
            { id: '512', codigo: 'MTR', nombre: 'Metro', state: true },
            { id: '874', codigo: 'GLL', nombre: 'Galon', state: true },
            { id: '111', codigo: 'MTQ', nombre: 'Metro Cubico', state: false },
            { id: '222', codigo: 'INH', nombre: 'Pulgada', state: false },
        ];

        for (const item of data) {
            const exists = await this.unidadMedidaRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.unidadMedidaRepo.save(item);
            }
        }
        this.logger.log('✔ Unidades de medida sincronizadas');
    }

    private async seedCategoriesArticles() {
        const data = Object.values(CATEGORIAS_ARTICULOS);

        for (const item of data) {
            const exists = await this.categoriasArticulosRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.categoriasArticulosRepo.save({
                    ...item,
                    state: true
                });
            }
        }
        this.logger.log('✔ Categorías de artículos sincronizadas');
    }
}
