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

@Controller('asientos-contables')
@UseGuards(AuthGuard, RolesGuard)
export class AsientosContablesController {
  constructor(
    private readonly asientosContablesService: AsientosContablesService,
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
}
