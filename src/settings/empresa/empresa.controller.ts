import { Controller, Get, Put, Body } from '@nestjs/common';
import { EmpresaService } from './empresa.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Controller('settings/empresa')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Get()
  getEmpresa() {
    return this.empresaService.getEmpresa();
  }

  @Put()
  update(@Body() updateEmpresaDto: UpdateEmpresaDto) {
    return this.empresaService.update(updateEmpresaDto);
  }
}
