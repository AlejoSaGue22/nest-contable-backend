import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotaAjusteCompra } from './entities/notas-ajuste-compra.entity';
import { ItemNotaAjusteCompra } from './entities/items-notas-ajuste-compra.entity';
import { FacturaCompra } from 'src/facturas-compras/entities/factura-compra.entity';
import { AsientosContablesModule } from 'src/asientos-contables/asientos-contables.module';
import { AuthModule } from 'src/auth/auth.module';
import { NotasAjusteComprasController } from './notas-ajuste-compras.controller';
import { NotasAjusteComprasService } from './notas-ajuste-compras.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotaAjusteCompra,
      ItemNotaAjusteCompra,
      FacturaCompra
    ]),
    forwardRef(() => AsientosContablesModule),
    AuthModule
  ],
  controllers: [NotasAjusteComprasController],
  providers: [NotasAjusteComprasService],
  exports: [NotasAjusteComprasService]
})
export class NotasAjusteComprasModule {}
