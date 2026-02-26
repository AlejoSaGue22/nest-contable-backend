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

    async findAllCategoriesArticles() {
        const data = await this.categoriasArticulosRepo.find();

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
            { codigo: '1', abreviatura: 'RC', nombre: 'Registro civil' },
            { codigo: '2', abreviatura: 'TI', nombre: 'Tarjeta de identidad' },
            { codigo: '3', abreviatura: 'CC', nombre: 'Cédula de ciudadanía' },
            { codigo: '4', abreviatura: 'TE', nombre: 'Tarjeta de extranjería' },
            { codigo: '5', abreviatura: 'CE', nombre: 'Cédula de extranjería' },
            { codigo: '6', abreviatura: 'NIT', nombre: 'NIT' },
            { codigo: '7', abreviatura: 'PAS', nombre: 'Pasaporte' },
            { codigo: '8', abreviatura: 'DIE', nombre: 'Documento de identificación extranjero' },
            { codigo: '9', abreviatura: 'PEP', nombre: 'PEP' },
            { codigo: '10', abreviatura: 'NIT', nombre: 'NIT otro país' },
            { codigo: '11', abreviatura: 'NUIP', nombre: 'NUIP' },
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

    private async seedCategoriesArticles() {
        const data = Object.values(CATEGORIAS_ARTICULOS);

        for (const item of data) {
            const exists = await this.categoriasArticulosRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.categoriasArticulosRepo.save(item);
            }
        }
        this.logger.log('✔ Categorías de artículos sincronizadas');
    }
}
