import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';
import { TipoDocumento } from './entities/tipo-documento.entity';
import { MetodoPago } from './entities/metodo-pago.entity';
import { CanalVenta } from './entities/canal-venta.entity';
import { UnidadMedida } from './entities/unidad-medida.entity';
import { CategoriaArticulo } from './entities/categorias-articulos-entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';
import { ConceptoCorreccion } from './entities/concepto-correcion.entity';
import { EntidadSeguridadSocial } from 'src/nomina/entities/entidad-seguridad-social.entity';
import { TipoContratoEntity } from 'src/nomina/entities/tipo-contrato.entity';
import { TipoActivo } from './entities/tipo-activo.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            TipoDocumento,
            MetodoPago,
            CanalVenta,
            UnidadMedida,
            CategoriaArticulo,
            CuentaContable,
            ConceptoCorreccion,
            EntidadSeguridadSocial,
            TipoContratoEntity,
            TipoActivo,
        ]),
    ],
    providers: [CatalogsService],
    controllers: [CatalogsController],
    exports: [CatalogsService],
})
export class CatalogsModule { }
