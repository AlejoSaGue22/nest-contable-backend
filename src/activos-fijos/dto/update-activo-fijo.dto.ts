import { PartialType } from '@nestjs/mapped-types';
import { CreateActivoFijoDto } from './create-activo-fijo.dto';

export class UpdateActivoFijoDto extends PartialType(CreateActivoFijoDto) {}
