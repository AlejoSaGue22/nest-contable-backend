import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { User } from 'src/users/entities/user.entity';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from '../auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

@Controller('menu')
@UseGuards(AuthGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  async getMenu(@CurrentUser() user: JwtPayload) {
    const menu = await this.menuService.getMenuForRole(user.role);
    return {
      success: true,
      data: menu,
      message: 'Menú obtenido exitosamente',
    };
  }

  @Get('role/:roleName')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async getMenuForRole(@Param('roleName') roleName: string) {
    const menu = await this.menuService.getMenuForRole(roleName);
    return {
      success: true,
      data: menu,
      message: `Menú para rol ${roleName} obtenido exitosamente`,
    };
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async getAllMenuItems() {
    const menuItems = await this.menuService.getAllMenuItems();
    return {
      success: true,
      data: menuItems,
      message: 'Todos los items del menú obtenidos exitosamente',
    };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async getMenuItem(@Param('id', ParseUUIDPipe) id: string) {
    const menuItem = await this.menuService.getMenuItem(id);
    return {
      success: true,
      data: menuItem,
      message: 'Item del menú obtenido exitosamente',
    };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async createMenuItem(@Body() createDto: CreateMenuDto) {
    // const menuItem = await this.menuService.createMenuItem(createDto);
    return {
      success: true,
      // data: menuItem,
      message: 'Item del menú creado exitosamente',
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async updateMenuItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMenuDto,
  ) {
    const menuItem = await this.menuService.updateMenuItem(id, updateDto);
    return {
      success: true,
      data: menuItem,
      message: 'Item del menú actualizado exitosamente',
    };
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
      data: menuItem,
      message: `Item del menú ${isActive ? 'activado' : 'desactivado'} exitosamente`,
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
      data: menuItem,
      message: `Item del menú ${isVisible ? 'hecho visible' : 'ocultado'} exitosamente`,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async deleteMenuItem(@Param('id', ParseUUIDPipe) id: string) {
    await this.menuService.deleteMenuItem(id);
    return {
      success: true,
      message: 'Item del menú eliminado exitosamente',
    };
  }

  @Post('reorder')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async reorderMenuItems(@Body('orderedIds') orderedIds: string[]) {
    const menuItems = await this.menuService.reorderMenuItems(orderedIds);
    return {
      success: true,
      data: menuItems,
      message: 'Menú reordenado exitosamente',
    };
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Permissions(Permission.MENU_MANAGE)
  async seedDefaultMenu() {
    await this.menuService.seedDefaultMenu();
    return {
      success: true,
      message: 'Menú por defecto creado exitosamente',
    };
  }
}
