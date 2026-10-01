import { PartialType } from '@nestjs/mapped-types';
import { CreateFacturasVentaDto } from './create-facturas-venta.dto';

export class UpdateFacturasVentaDto extends PartialType(CreateFacturasVentaDto) {}
