import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';

@Controller('catalogs')
export class CatalogsController {
    constructor(private readonly catalogsService: CatalogsService) { }

    @Get('document-types')
    findAllDocumentTypes() {
        return this.catalogsService.findAllDocumentTypes();
    }

    @Get('payment-methods')
    findAllPaymentMethods() {
        return this.catalogsService.findAllPaymentMethods();
    }

    @Get('sales-channels')
    findAllSalesChannels() {
        return this.catalogsService.findAllSalesChannels();
    }

    @Get('units-measure')
    findAllUnitsMeasure() {
        return this.catalogsService.findAllUnitsMeasure();
    }

    @Get('categories-articles')
    findAllCategoriesArticles(@Query() pagination: PaginatioDto) {
        return this.catalogsService.findAllCategoriesArticles(pagination);
    }

    @Get('categories-articles/:id')
    findCategoryArticleById(@Param('id') id: string) {
        // return this.catalogsService.findCategoryArticleById(id);
    }


}
