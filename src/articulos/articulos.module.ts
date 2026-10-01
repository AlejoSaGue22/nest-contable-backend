import { Module } from '@nestjs/common';
import { ArticulosService } from './articulos.service';
import { ArticulosController } from './articulos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Articulo } from './entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { UnidadMedida } from 'src/core/catalogs/entities/unidad-medida.entity';
import { CategoriaArticulo } from 'src/core/catalogs/entities/categorias-articulos-entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Articulo, CuentaContable, UnidadMedida, CategoriaArticulo, Impuesto])],
  controllers: [ArticulosController],
  providers: [ArticulosService],
  exports: [ArticulosService, TypeOrmModule],
})
export class ArticulosModule { }
