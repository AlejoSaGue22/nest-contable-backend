import { Body, Controller, Get, Param, Post, Query, Patch, Delete } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { PaginatioDto } from 'src/common/dtos/pagination.dto';
import { CreateCategoryArticleDto } from './dtos/create-category.dto';
import { UpdateCategoryArticleDto } from './dtos/update-category.dto';

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

    @Get('concepts-notes')
    findAllConceptsNotes() {
        return this.catalogsService.findAllConceptsNotes();
    }

    // Categorias de articulos
    @Get('categories-articles')
    findAllCategoriesArticles(@Query() pagination: PaginatioDto) {
        return this.catalogsService.findAllCategoriesArticles(pagination);
    }

    @Get('categories-articles/:id')
    findCategoryArticleById(@Param('id') id: string) {
        return this.catalogsService.findCategoryArticleById(id);
    }

    @Post('categories-articles')
    createCategoryArticle(@Body() createCategoryArticleDto: CreateCategoryArticleDto) {
        return this.catalogsService.createCategoryArticle(createCategoryArticleDto);
    }

    @Patch('categories-articles/:id')
    updateCategoryArticle(@Param('id') id: string, @Body() updateCategoryArticleDto: UpdateCategoryArticleDto) {
        return this.catalogsService.updateCategoryArticle(id, updateCategoryArticleDto);
    }

    @Delete('categories-articles/:id')
    removeCategoryArticle(@Param('id') id: string) {
        return this.catalogsService.removeCategoryArticle(id);
    }
}
