import { PartialType } from '@nestjs/mapped-types';
import { RegistrarPagoDto } from './create-pago.dto';

export class UpdatePagoDto extends PartialType(RegistrarPagoDto) { }
