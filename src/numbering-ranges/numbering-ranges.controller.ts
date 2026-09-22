import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FactusNumberingRangeService } from './factus-numbering-range.service';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Permission } from 'src/common/constants/roles.constants';
import {
  CreateNumberingRangeDto,
  ListNumberingRangesDto,
  RangeDomainQueryDto,
  SyncNumberingRangesDto,
  UpdateRangeCurrentDto,
} from './dto/numbering-range.dto';

/**
 * Administración de rangos de numeración DIAN (caché local + proxy Factus).
 * Lectura: SETTINGS_VIEW. Mutaciones y sync: SETTINGS_MANAGE.
 */
@Controller('numbering-ranges')
@UseGuards(AuthGuard)
export class NumberingRangesController {
  constructor(private readonly rangeService: FactusNumberingRangeService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Permissions(Permission.SETTINGS_VIEW)
  async list(@Query() query: ListNumberingRangesDto) {
    const data = await this.rangeService.listCached({
      domain: query.domain,
      document: query.document,
      isActive: query.isActive,
    });
    return { success: true, data, message: 'Rangos obtenidos del caché local' };
  }

  @Post('sync')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SETTINGS_MANAGE)
  async sync(@Body() body: SyncNumberingRangesDto) {
    const domains = body.domain ? [body.domain] : (['billing', 'payroll'] as const);
    const result: Record<string, unknown> = {};
    for (const domain of domains) {
      try {
        const ranges = await this.rangeService.syncFromApi(domain);
        result[domain] = { synced: ranges.length };
      } catch (error) {
        result[domain] = { error: error.message };
      }
    }
    return { success: true, data: result, message: 'Sincronización ejecutada' };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SETTINGS_VIEW)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: RangeDomainQueryDto,
    @Query('refresh') refresh?: string,
  ) {
    const domain = query.domain ?? 'billing';
    if (refresh === 'true' || refresh === '1') {
      const data = await this.rangeService.refreshOne(domain, id);
      return { success: true, data, message: 'Rango actualizado desde Factus' };
    }
    const data = await this.rangeService.findCached(domain, id);
    return { success: true, data, message: 'Rango obtenido del caché local' };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.SETTINGS_MANAGE)
  async create(@Body() body: CreateNumberingRangeDto) {
    const data = await this.rangeService.createInFactus(body.domain ?? 'billing', body.payload);
    return { success: true, data, message: 'Rango creado en Factus y sincronizado' };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SETTINGS_MANAGE)
  async remove(@Param('id', ParseIntPipe) id: number, @Query() query: RangeDomainQueryDto) {
    await this.rangeService.deleteInFactus(query.domain ?? 'billing', id);
    return { success: true, data: null, message: `Rango ${id} eliminado` };
  }

  @Patch(':id/toggle-status')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SETTINGS_MANAGE)
  async toggleStatus(@Param('id', ParseIntPipe) id: number, @Query() query: RangeDomainQueryDto) {
    const data = await this.rangeService.toggleStatus(query.domain ?? 'billing', id);
    return { success: true, data, message: `Estado del rango ${id} actualizado` };
  }

  @Patch(':id/current')
  @UseGuards(RolesGuard)
  @Permissions(Permission.SETTINGS_MANAGE)
  async updateCurrent(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateRangeCurrentDto) {
    const data = await this.rangeService.updateCurrent(body.domain ?? 'billing', id, {
      current: body.current,
    });
    return { success: true, data, message: `Consecutivo del rango ${id} actualizado` };
  }
}
