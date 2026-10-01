import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresaService } from './empresa.service';
import { EmpresaController } from './empresa.controller';
import { Empresa } from './entities/empresa.entity';
import { Municipality } from 'src/core/municipalities/entities/municipality.entity';
import { CompanyContext } from './company-context.service';
import { CompanyInterceptor } from './interceptors/company.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa, Municipality])],
  controllers: [EmpresaController],
  providers: [EmpresaService, CompanyContext, CompanyInterceptor],
  exports: [EmpresaService, CompanyContext, CompanyInterceptor],
})
export class EmpresaModule {}
