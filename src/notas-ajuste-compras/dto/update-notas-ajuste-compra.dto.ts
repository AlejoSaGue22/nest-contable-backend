import { PartialType } from '@nestjs/mapped-types';
import { CreateNotasAjusteCompraDto } from './create-notas-ajuste-compra.dto';

export class UpdateNotasAjusteCompraDto extends PartialType(CreateNotasAjusteCompraDto) { }
