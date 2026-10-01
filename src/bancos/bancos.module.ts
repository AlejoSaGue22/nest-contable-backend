import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banco } from './entities/banco.entity';
import { BancosService } from './bancos.service';
import { BancosController } from './bancos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Banco])],
  controllers: [BancosController],
  providers: [BancosService],
  exports: [BancosService, TypeOrmModule],
})
export class BancosModule {}
