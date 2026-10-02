import { Module } from '@nestjs/common';
import { DocumentosSoportesService } from './documentos-soportes.service';
import { DocumentosSoportesController } from './documentos-soportes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentoSoporte } from './entities/documento-soporte.entity';
import { DocumentoSoporteDetalle } from './entities/documento-soporte-detalle.entity';
import { NotaAjusteSoporte } from 'src/notas-ajuste-soporte/entities/nota-ajuste-soporte.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { Proveedor } from 'src/proveedores/entities/proveedor.entity';
import { Articulo } from 'src/articulos/entities/articulos.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { CuentasBancarias } from 'src/cuentas-bancarias/entities/cuentas-bancaria.entity';
import { ParametrizacionContableModule } from 'src/settings/parametrizacion-contable/parametrizacion-contable.module';
import { PagosModule } from 'src/pagos/pagos.module';
import { InventarioModule } from 'src/inventario/inventario.module';
import { ApiDianModule } from 'src/api-dian/api-dian.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([DocumentoSoporte, DocumentoSoporteDetalle, Proveedor, Articulo, Impuesto, CuentasBancarias, NotaAjusteSoporte]),
        AsientosContablesModule,
        PagosModule,
        ParametrizacionContableModule,
        InventarioModule,
        ApiDianModule,
    ],
    controllers: [DocumentosSoportesController],
    providers: [DocumentosSoportesService],
    exports: [DocumentosSoportesService]
})
export class DocumentosSoportesModule { }
