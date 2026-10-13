import { PartialType } from '@nestjs/mapped-types';
import { SaveProfesionalResponsableDto } from './save-profesional-responsable.dto';

export class UpdateProfesionalResponsableDto extends PartialType(SaveProfesionalResponsableDto) {}
