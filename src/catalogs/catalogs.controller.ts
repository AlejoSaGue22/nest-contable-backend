import { Controller, Get } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';

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
}
