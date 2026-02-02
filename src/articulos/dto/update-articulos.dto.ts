import { PartialType } from '@nestjs/mapped-types';
import { CreateArticuloDto } from './create-articulos.dto';

export class UpdateArticuloDto extends PartialType(CreateArticuloDto) { }
