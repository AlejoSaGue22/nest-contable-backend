import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AsientosContablesService } from './asientos-contables.service';
import { CreateAsientosContableDto } from './dto/create-asientos-contable.dto';
import { UpdateAsientosContableDto } from './dto/update-asientos-contable.dto';

@Controller('asientos-contables')
export class AsientosContablesController {
  constructor(private readonly asientosContablesService: AsientosContablesService) { }

  @Post()
  create(@Body() createAsientosContableDto: CreateAsientosContableDto) {
    // return this.asientosContablesService.create(createAsientosContableDto);
    // TODO: Implementar create
  }

  @Get()
  findAll() {
    // return this.asientosContablesService.findAll();
    // TODO: Implementar findAll
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // return this.asientosContablesService.findOne(+id);
    // TODO: Implementar findOne
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAsientosContableDto: UpdateAsientosContableDto) {
    // return this.asientosContablesService.update(+id, updateAsientosContableDto);
    // TODO: Implementar update
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    // return this.asientosContablesService.remove(+id);
    // TODO: Implementar remove
  }
}
