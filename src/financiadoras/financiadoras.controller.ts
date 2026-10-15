import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { CreateFinanciadoraDto } from './dto/create-financiadora.dto';
import { UpdateFinanciadoraDto } from './dto/update-financiadora.dto';
import { FinanciadorasService } from './financiadoras.service';

@Controller('financiadoras')
@UseGuards(AuthGuard, RolesGuard)
export class FinanciadorasController {
  constructor(private readonly service: FinanciadorasService) {}

  @Get()
  async findAll() {
    return { success: true, data: await this.service.findAll() };
  }

  @Post()
  async create(@Body() dto: CreateFinanciadoraDto) {
    return { success: true, data: await this.service.create(dto), message: 'Financiadora creada' };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateFinanciadoraDto) {
    return { success: true, data: await this.service.update(id, dto), message: 'Financiadora actualizada' };
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    await this.service.deactivate(id);
    return { success: true, message: 'Financiadora desactivada' };
  }
}
