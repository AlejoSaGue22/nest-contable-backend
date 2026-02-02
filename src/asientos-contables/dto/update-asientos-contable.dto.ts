import { PartialType } from '@nestjs/mapped-types';
import { CreateAsientosContableDto } from './create-asientos-contable.dto';

export class UpdateAsientosContableDto extends PartialType(CreateAsientosContableDto) {}
