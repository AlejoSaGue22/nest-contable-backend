import { Injectable } from '@nestjs/common';
import { CreateCuentasBancariaDto } from './dto/create-cuentas-bancaria.dto';
import { UpdateCuentasBancariaDto } from './dto/update-cuentas-bancaria.dto';

@Injectable()
export class CuentasBancariasService {
  create(createCuentasBancariaDto: CreateCuentasBancariaDto) {
    return 'This action adds a new cuentasBancaria';
  }

  findAll() {
    return `This action returns all cuentasBancarias`;
  }

  findOne(id: number) {
    return `This action returns a #${id} cuentasBancaria`;
  }

  update(id: number, updateCuentasBancariaDto: UpdateCuentasBancariaDto) {
    return `This action updates a #${id} cuentasBancaria`;
  }

  remove(id: number) {
    return `This action removes a #${id} cuentasBancaria`;
  }
}
