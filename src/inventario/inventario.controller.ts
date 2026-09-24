import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from 'src/auth/decorators/roles.decorator';
import { Req } from '@nestjs/common';
import { AuthenticatedRequest } from 'src/auth/interfaces/jwt-payload.interface';

@Controller('inventario')
@UseGuards(AuthGuard, RolesGuard)
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) { }

  /** Stock actual + últimos movimientos de un artículo. */
  @Get('stock/:articuloId')
  @Permissions(Permission.PRODUCT_READ)
  async stock(@Param('articuloId') articuloId: string) {
    const data = await this.inventarioService.obtenerStock(articuloId);
    return { success: true, message: 'Stock obtenido', data };
  }

  /** Ajuste manual (carga inicial, conteo). cantidad + entra, − sale. */
  @Post('ajuste')
  @Permissions(Permission.PRODUCT_UPDATE)
  async ajuste(
    @Body() body: { articuloId: string; cantidad: number; motivo?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.inventarioService.ajusteManual(
      body.articuloId,
      Number(body.cantidad),
      body.motivo || 'Ajuste manual',
      req.user.sub,
    );
    return { success: true, message: 'Ajuste registrado', data };
  }

  /**
   * Carga bulk de saldos iniciales: fija el stock deseado por artículo
   * (solo artículos sin kardex previo). Idempotente por omisión.
   */
  @Post('saldos-iniciales')
  @Permissions(Permission.PRODUCT_UPDATE)
  async saldosIniciales(@Body() body: { items: Array<{ articuloId: string; cantidad: number }> }, @Req() req: AuthenticatedRequest,) {
    const data = await this.inventarioService.cargarSaldosIniciales(
      body.items ?? [],
      req.user.sub,
    );
    return { success: true, message: 'Saldos iniciales procesados', data };
  }
}
