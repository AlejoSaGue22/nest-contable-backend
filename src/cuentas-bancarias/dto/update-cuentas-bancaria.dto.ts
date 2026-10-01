import { PartialType } from '@nestjs/mapped-types';
import { CreateCuentasBancariaDto } from './create-cuentas-bancaria.dto';

export class UpdateCuentasBancariaDto extends PartialType(CreateCuentasBancariaDto) {}
