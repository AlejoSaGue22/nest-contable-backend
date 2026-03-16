import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Municipality } from './entities/municipality.entity';
import { MunicipalitiesService } from './municipalities.service';
import { MunicipalitiesController } from './municipalities.controller';
import { ApiDianModule } from 'src/api-dian/api-dian.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Municipality]),
        ApiDianModule,
    ],
    controllers: [MunicipalitiesController],
    providers: [MunicipalitiesService],
    exports: [MunicipalitiesService],
})
export class MunicipalitiesModule { }
