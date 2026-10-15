import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Financiadora } from './entities/financiadora.entity';
import { FinanciadorasController } from './financiadoras.controller';
import { FinanciadorasService } from './financiadoras.service';

@Module({
  imports: [TypeOrmModule.forFeature([Financiadora])],
  controllers: [FinanciadorasController],
  providers: [FinanciadorasService],
  exports: [TypeOrmModule],
})
export class FinanciadorasModule {}
