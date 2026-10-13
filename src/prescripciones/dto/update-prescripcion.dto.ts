import { PartialType } from '@nestjs/mapped-types';
import { CreatePrescripcionDto } from './create-prescripcion.dto';
export class UpdatePrescripcionDto extends PartialType(CreatePrescripcionDto) {}
