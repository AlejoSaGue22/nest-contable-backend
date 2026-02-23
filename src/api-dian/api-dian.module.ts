import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FactusService } from './services/factus.service';

@Module({
    imports: [HttpModule],
    providers: [FactusService],
    exports: [FactusService],
})
export class ApiDianModule { }
