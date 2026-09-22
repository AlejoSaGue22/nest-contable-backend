import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FactusAuthService } from 'src/api-dian/services/factus-auth.service';
import { FactusNumberingRange } from './entities/factus-numbering-range.entity';
import { FactusNumberingRangeService } from './factus-numbering-range.service';
import { NumberingRangesController } from './numbering-ranges.controller';
import { NumberingRangesScheduler } from './numbering-ranges.scheduler';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([FactusNumberingRange])],
  controllers: [NumberingRangesController],
  providers: [FactusAuthService, FactusNumberingRangeService, NumberingRangesScheduler],
  exports: [FactusAuthService, FactusNumberingRangeService],
})
export class NumberingRangesModule {}
