import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { TipoDocumento } from 'src/core/catalogs/entities/tipo-documento.entity';
import { ParametrizacionContableModule } from 'src/settings/parametrizacion-contable/parametrizacion-contable.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, TipoDocumento]),
    ParametrizacionContableModule,
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [TypeOrmModule]
})
export class ClientesModule { }
