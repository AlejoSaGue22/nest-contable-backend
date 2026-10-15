import { PartialType } from '@nestjs/mapped-types';
import { CreateFinanciadoraDto } from './create-financiadora.dto';

export class UpdateFinanciadoraDto extends PartialType(CreateFinanciadoraDto) {}
