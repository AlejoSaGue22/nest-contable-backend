import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotaAjusteSoporte } from './entities/nota-ajuste-soporte.entity';
import { ItemNotaAjusteSoporte } from './entities/item-nota-ajuste-soporte.entity';
import { DocumentoSoporte } from 'src/documentos-soportes/entities/documento-soporte.entity';
import { Impuesto } from 'src/settings/impuestos/entities/impuesto.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { AuthModule } from 'src/auth/auth.module';
import { NotasAjusteSoporteController } from './notas-ajuste-soporte.controller';
import { NotasAjusteSoporteService } from './notas-ajuste-soporte.service';
import { InventarioModule } from 'src/inventario/inventario.module';
import { ApiDianModule } from 'src/api-dian/api-dian.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotaAjusteSoporte,
      ItemNotaAjusteSoporte,
      DocumentoSoporte,
      Impuesto
    ]),
    forwardRef(() => AsientosContablesModule),
    AuthModule,
    InventarioModule,
    ApiDianModule,
  ],
  controllers: [NotasAjusteSoporteController],
  providers: [NotasAjusteSoporteService],
  exports: [NotasAjusteSoporteService]
})
export class NotasAjusteSoporteModule {}
