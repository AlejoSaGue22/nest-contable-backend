import { Module } from '@nestjs/common';
import { ArticulosService } from './articulos.service';
import { ArticulosController } from './articulos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Articulo } from './entities/articulos.entity';
import { CuentaContable } from 'src/cuentas/entities/cuenta.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Articulo, CuentaContable])],
  controllers: [ArticulosController],
  providers: [ArticulosService],
  exports: [ArticulosService, TypeOrmModule],
})
export class ArticulosModule { }
