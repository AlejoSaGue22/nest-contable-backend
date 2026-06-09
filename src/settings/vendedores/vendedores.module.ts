import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendedoresService } from './vendedores.service';
import { VendedoresController } from './vendedores.controller';
import { Vendedor } from './entities/vendedor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vendedor])],
  controllers: [VendedoresController],
  providers: [VendedoresService],
  exports: [VendedoresService],
})
export class VendedoresModule {}
