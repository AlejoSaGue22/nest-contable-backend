import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ParametrizacionContableService } from './parametrizacion-contable.service';
import { ParametrizacionContable } from './entities/parametrizacion-contable.entity';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('settings/parametrizacion-contable')
export class ParametrizacionContableController {
  constructor(private readonly parametrizacionService: ParametrizacionContableService) {}

  @Get()
  getConfiguracion() {
    return this.parametrizacionService.getConfiguracion();
  }

  @Put()
  updateConfiguracion(@Body() data: Partial<ParametrizacionContable>) {
    return this.parametrizacionService.updateConfiguracion(data);
  }
}
