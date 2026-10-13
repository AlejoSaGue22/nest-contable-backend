import { PartialType } from '@nestjs/mapped-types';
import { SaveTipoExamenDto } from './save-tipo-examen.dto';

export class UpdateTipoExamenDto extends PartialType(SaveTipoExamenDto) {}
