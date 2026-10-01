import { PartialType } from '@nestjs/mapped-types';
import { CreateItemNotaAjusteDto } from './create-items-notas-ajuste.dto';

export class UpdateItemNotaAjusteDto extends PartialType(CreateItemNotaAjusteDto) {}
