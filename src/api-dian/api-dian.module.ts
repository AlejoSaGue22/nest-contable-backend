import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FactusService } from './services/factus.service';
import { EmpresaModule } from '../settings/empresa/empresa.module';

@Module({
    imports: [HttpModule, EmpresaModule],
    providers: [FactusService],
    exports: [FactusService],
})
export class ApiDianModule { }
