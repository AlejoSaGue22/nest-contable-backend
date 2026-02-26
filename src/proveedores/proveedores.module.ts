import { Module } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresController } from './proveedores.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Proveedor } from './entities/proveedor.entity';
import { TipoDocumento } from 'src/catalogs/entities/tipo-documento.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Proveedor, TipoDocumento])],
    controllers: [ProveedoresController],
    providers: [ProveedoresService],
    exports: [ProveedoresService]
})
export class ProveedoresModule { }
