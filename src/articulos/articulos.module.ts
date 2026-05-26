import { Module } from '@nestjs/common';
import { ArticulosService } from './articulos.service';
import { ArticulosController } from './articulos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Articulo } from './entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { UnidadMedida } from 'src/core/catalogs/entities/unidad-medida.entity';
import { CategoriaArticulo } from 'src/core/catalogs/entities/categorias-articulos-entity';

@Module({
  imports: [TypeOrmModule.forFeature([Articulo, CuentaContable, UnidadMedida, CategoriaArticulo])],
  controllers: [ArticulosController],
  providers: [ArticulosService],
  exports: [ArticulosService, TypeOrmModule],
})
export class ArticulosModule { }
