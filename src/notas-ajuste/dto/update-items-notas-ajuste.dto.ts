import { PartialType } from '@nestjs/mapped-types';
import { CreateNotasAjusteDto } from './create-notas-ajuste.dto';

export class UpdateNotasAjusteDto extends PartialType(CreateNotasAjusteDto) {}
