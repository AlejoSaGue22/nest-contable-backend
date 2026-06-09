import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { VendedoresService } from './vendedores.service';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';

@Controller('settings/vendedores')
export class VendedoresController {
  constructor(private readonly vendedoresService: VendedoresService) {}

  @Post()
  create(@Body() createVendedorDto: CreateVendedorDto) {
    return this.vendedoresService.create(createVendedorDto);
  }

  @Get()
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.vendedoresService.findAll(+page, +limit, search);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendedoresService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateVendedorDto: UpdateVendedorDto) {
    return this.vendedoresService.update(id, updateVendedorDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendedoresService.remove(id);
  }
}
