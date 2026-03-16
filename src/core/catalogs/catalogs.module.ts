import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';
import { TipoDocumento } from './entities/tipo-documento.entity';
import { MetodoPago } from './entities/metodo-pago.entity';
import { CanalVenta } from './entities/canal-venta.entity';
import { UnidadMedida } from './entities/unidad-medida.entity';
import { CategoriaArticulo } from './entities/categorias-articulos-entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            TipoDocumento,
            MetodoPago,
            CanalVenta,
            UnidadMedida,
            CategoriaArticulo,
        ]),
    ],
    providers: [CatalogsService],
    controllers: [CatalogsController],
    exports: [CatalogsService],
})
export class CatalogsModule { }
