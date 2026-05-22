import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TipoDocumento } from './entities/tipo-documento.entity';
import { MetodoPago } from './entities/metodo-pago.entity';
import { CanalVenta } from './entities/canal-venta.entity';
import { UnidadMedida } from './entities/unidad-medida.entity';
import { CategoriaArticulo } from './entities/categorias-articulos-entity';
import { CATEGORIAS_ARTICULOS } from 'src/common/constants/categorias-articulos.config';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { CreateCategoryArticleDto } from './dtos/create-category.dto';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { UpdateCategoryArticleDto } from './dtos/update-category.dto';
import { NotFoundException } from '@nestjs/common';
import { ConceptoCorreccion } from './entities/concepto-correcion.entity';

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
        @InjectRepository(CuentaContable)
        private cuentaContableRepo: Repository<CuentaContable>,
        @InjectRepository(ConceptoCorreccion)
        private conceptoCorreccionRepo: Repository<ConceptoCorreccion>,
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

    async findAllConceptsNotes() {
        return this.conceptoCorreccionRepo.find({ where: { state: true } });
    }

    async findAllCategoriesArticles(pagination: PaginatioDto) {
        const { limit = 10, offset = 0 } = pagination;

        const data = await this.categoriasArticulosRepo.find({
            where: { state: true },
            relations: ['cuentaPrincipal', 'cuentaCosto', 'cuentaInventario'],
            order: { nombre: 'ASC' },
            take: limit,
            skip: offset,
        });

        const count = await this.categoriasArticulosRepo.count({ where: { state: true } });

        return {
            count: count,
            pages: Math.ceil(count / limit),
            categoriesArticles: data
        };
    }

    async findCategoryArticleById(id: string) {
        const category = await this.categoriasArticulosRepo.findOne({
            where: { id, state: true },
            relations: ['cuentaPrincipal', 'cuentaCosto', 'cuentaInventario']
        });

        if (!category) {
            throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
        }

        return category;
    }

    async createCategoryArticle(createCategoryArticleDto: CreateCategoryArticleDto) {
        const { nombre, cuentaPrincipalId, cuentaCostoId, cuentaInventarioId, ...rest } = createCategoryArticleDto;

        const category = await this.categoriasArticulosRepo.findOne({ where: { nombre } });
        if (category) throw new BadRequestException(`Categoría ${nombre} ya existe`);   

        const cPrincipal = await this.cuentaContableRepo.findOne({ where: { id: cuentaPrincipalId } });
        if (!cPrincipal) throw new BadRequestException(`Cuenta principal ${cuentaPrincipalId} no encontrada`);

        let cCosto: CuentaContable | null = null;
        if (cuentaCostoId) {
            cCosto = await this.cuentaContableRepo.findOne({ where: { id: cuentaCostoId } });
            if (!cCosto) throw new BadRequestException(`Cuenta de costo ${cuentaCostoId} no encontrada`);
        }

        let cInventario: CuentaContable | null = null;
        if (cuentaInventarioId) {
            cInventario = await this.cuentaContableRepo.findOne({ where: { id: cuentaInventarioId } });
            if (!cInventario) throw new BadRequestException(`Cuenta de inventario ${cuentaInventarioId} no encontrada`);
        }

        const codigo = this.generarCodigo(nombre);

        const newCategory = this.categoriasArticulosRepo.create({
            ...rest,
            nombre,
            codigo,
            cuentaPrincipal: cPrincipal,
            cuentaCosto: cCosto,
            cuentaInventarioId,
        });

        if (cuentaPrincipalId) {
            const cPrincipal = await this.cuentaContableRepo.findOne({ where: { id: cuentaPrincipalId } });
            if (!cPrincipal) throw new BadRequestException(`Cuenta principal ${cuentaPrincipalId} no encontrada`);
            category.cuentaPrincipal = cPrincipal;
        }

        if (cuentaCostoId) {
            const cCosto = await this.cuentaContableRepo.findOne({ where: { id: cuentaCostoId } });
            if (!cCosto) throw new BadRequestException(`Cuenta de costo ${cuentaCostoId} no encontrada`);
            category.cuentaCosto = cCosto;
        } else if (cuentaCostoId === null) {
            category.cuentaCosto = null;
        }

        if (cuentaInventarioId) {
            const cInventario = await this.cuentaContableRepo.findOne({ where: { id: cuentaInventarioId } });
            if (!cInventario) throw new BadRequestException(`Cuenta de inventario ${cuentaInventarioId} no encontrada`);
            category.cuentaInventario = cInventario;
        } else if (cuentaInventarioId === null) {
            category.cuentaInventario = null
        }

        Object.assign(category, rest);

        return await this.categoriasArticulosRepo.save(category);
    }

    async removeCategoryArticle(id: string) {
        const category = await this.findCategoryArticleById(id);
        category.state = false;
        await this.categoriasArticulosRepo.save(category);
        return { message: 'Categoría eliminada correctamente' };
    }

    async seedAll() {
        await this.seedDocumentTypes();
        await this.seedPaymentMethods();
        await this.seedSalesChannels();
        await this.seedUnitsMeasure();
        await this.seedCategoriesArticles();
        await this.seedConceptsCorrections();
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

    private async seedConceptsCorrections() {
        const data = [
            { codigo: '1', nombre: 'Devolución parcial de los bienes y/o no aceptación parcial del servicio', state: true },
            { codigo: '2', nombre: 'Anulación de factura electrónica', state: true },
            { codigo: '3', nombre: 'Rebaja o descuento parcial o total', state: true },
            { codigo: '4', nombre: 'Ajuste de precio', state: true },
            { codigo: '5', nombre: 'Descuento comercial por pronto pago', state: true },
            { codigo: '6', nombre: 'Descuento comercial por volumen de ventas', state: true },
        ];

        for (const item of data) {
            const exists = await this.conceptoCorreccionRepo.findOne({ where: { codigo: item.codigo } });
            if (!exists) {
                await this.conceptoCorreccionRepo.save(item);
            }
        }
        this.logger.log('✔ Conceptos de corrección sincronizados');
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

    // Categorias de articulos
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

    private generarCodigo(nombre: string): string {
        const codigo = nombre.toLowerCase().replace(/[^a-z]/g, '_');
        return codigo;
    }
}
