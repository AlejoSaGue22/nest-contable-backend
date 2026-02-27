import { Module } from '@nestjs/common';
import { ArticulosService } from './articulos.service';
import { ArticulosController } from './articulos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Articulo } from './entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { UnidadMedida } from 'src/catalogs/entities/unidad-medida.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Articulo, CuentaContable, UnidadMedida])],
  controllers: [ArticulosController],
  providers: [ArticulosService],
  exports: [ArticulosService, TypeOrmModule],
})
export class ArticulosModule { }
