import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AsientosContablesService } from './asientos-contables.service';
import { CreateAsientosContableDto } from './dto/create-asientos-contable.dto';
import { UpdateAsientosContableDto } from './dto/update-asientos-contable.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { ContabilizacionEngine } from './engine/contabilizacion.engine';

@Controller('asientos-contables')
@UseGuards(AuthGuard, RolesGuard)
export class AsientosContablesController {
  constructor(
    private readonly asientosContablesService: AsientosContablesService,
    private readonly contabilizacionEngine: ContabilizacionEngine,
  ) {}

  @Post()
  create(@Body() createAsientosContableDto: CreateAsientosContableDto) {
    // return this.asientosContablesService.create(createAsientosContableDto);
    // TODO: Implementar create
  }

  @Get('por-referencia/:referencia')
  @UseGuards(AuthGuard)
  async porReferencia(@Param('referencia') referencia: string) {
    return this.asientosContablesService.findByReferencia(referencia);
  }

  @Get('preview/:tipo/:id')
  @UseGuards(AuthGuard)
  async preview(@Param('tipo') tipo: string, @Param('id') id: string) {
    return this.contabilizacionEngine.previsualizarAsiento(tipo, id);
  }
}
