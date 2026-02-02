import { PartialType } from '@nestjs/mapped-types';
import { CreateFacturaCompraItemDto } from './create-items-factura-compra.dto';

export class UpdateItemsFacturaCompraDto extends PartialType(CreateFacturaCompraItemDto) { }
