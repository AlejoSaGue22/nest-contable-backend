import { PartialType } from '@nestjs/mapped-types';
import { CreateFacturaCompraDto } from './create-factura-compra.dto';

export class UpdateFacturaCompraDto extends PartialType(CreateFacturaCompraDto) { }
