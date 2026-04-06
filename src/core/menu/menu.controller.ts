import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { MenuService }    from './menu.service';
import { CreateMenuDto }  from './dto/create-menu.dto';
import { UpdateMenuDto }  from './dto/update-menu.dto';
import { AuthGuard }      from 'src/auth/guard/auth/auth.guard';
import { RolesGuard }     from 'src/auth/guard/auth/roles.guard';
import { Permission }     from 'src/common/constants/roles.constants';
import { Permissions }    from 'src/auth/decorators/roles.decorator';
import { CurrentUser }    from 'src/auth/decorators/current-user.decorator';
import { JwtPayload }     from 'src/auth/interfaces/jwt-payload.interface';

@Controller('menu')
@UseGuards(AuthGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ── Menú del usuario autenticado ─────────────────────────────────
  /**
   * ✅ FIX: antes usaba getMenuForRole(user.role) que solo considera
   * el rol genérico. Ahora usa getMenuForUser(user) que usa los
   * permisos exactos del JWT (útil cuando los permisos se personalizan
   * por usuario más allá del rol base).
   */
  @Get()
  async getMenu(@CurrentUser() user: JwtPayload) {
    const menu = await this.menuService.getMenuForUser(user);
    return {
      success: true,
      data:    menu,
      message: 'Menú obtenido exitosamente',
    };
  }

  // ── Previsualización por rol (admin) ──────────────────────────────
  @Get('role/:roleName')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async getMenuForRole(@Param('roleName') roleName: string) {
    const menu = await this.menuService.getMenuForRole(roleName);
    return {
      success: true,
      data:    menu,
      message: `Menú para rol ${roleName} obtenido exitosamente`,
    };
  }

  // ── Todos los ítems (admin — gestor de menú) ──────────────────────
  @Get('all')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async getAllMenuItems() {
    const menuItems = await this.menuService.getAllMenuItems();
    return {
      success: true,
      data:    menuItems,
      message: 'Todos los ítems del menú obtenidos exitosamente',
    };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async getMenuItem(@Param('id', ParseUUIDPipe) id: string) {
    const menuItem = await this.menuService.getMenuItem(id);
    return { success: true, data: menuItem, message: 'Ítem obtenido exitosamente' };
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async createMenuItem(@Body() createDto: CreateMenuDto) {
    const menuItem = await this.menuService.createMenuItem(createDto);
    return { success: true, data: menuItem, message: 'Ítem creado exitosamente' };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async updateMenuItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMenuDto,
  ) {
    const menuItem = await this.menuService.updateMenuItem(id, updateDto);
    return { success: true, data: menuItem, message: 'Ítem actualizado exitosamente' };
  }

  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const menuItem = await this.menuService.toggleMenuItemStatus(id, isActive);
    return {
      success: true,
      data:    menuItem,
      message: `Ítem ${isActive ? 'activado' : 'desactivado'} exitosamente`,
    };
  }

  @Patch(':id/toggle-visible')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async toggleVisible(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isVisible') isVisible: boolean,
  ) {
    const menuItem = await this.menuService.toggleMenuItemVisibility(id, isVisible);
    return {
      success: true,
      data:    menuItem,
      message: `Ítem ${isVisible ? 'hecho visible' : 'ocultado'} exitosamente`,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async deleteMenuItem(@Param('id', ParseUUIDPipe) id: string) {
    await this.menuService.deleteMenuItem(id);
    return { success: true, message: 'Ítem eliminado exitosamente' };
  }

  // ── Reordenar ─────────────────────────────────────────────────────
  @Post('reorder')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async reorderMenuItems(@Body('orderedIds') orderedIds: string[]) {
    const menuItems = await this.menuService.reorderMenuItems(orderedIds);
    return { success: true, data: menuItems, message: 'Menú reordenado exitosamente' };
  }

  // ── Seed ──────────────────────────────────────────────────────────
  @Post('seed')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async seedDefaultMenu() {
    await this.menuService.seedDefaultMenu();
    return { success: true, message: 'Menú por defecto creado exitosamente' };
  }
}