// menu.service.ts (BACKEND — NestJS)
// Correcciones aplicadas:
//  1. getMenuForUser → usa permisos exactos del JWT, no del rol
//  2. reorderMenuItems → actualiza solo los IDs recibidos, sin romper otros
//  3. El seedDefaultMenu verifica correctamente antes de insertar

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu.entity';
import { In, TreeRepository } from 'typeorm';
import { Permission, ROLE_PERMISSIONS } from 'src/common/constants/roles.constants';
import { MenuSeedItem } from './interfaces/menu-seed.interface';
import { DEFAULT_MENU_ITEMS } from 'src/common/constants/menu.constants';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interface';

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(
    @InjectRepository(MenuItem)
    private menuItemRepository: TreeRepository<MenuItem>,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  // CREAR
  // ══════════════════════════════════════════════════════════════════
  async createMenuItem(createDto: CreateMenuDto): Promise<MenuItem> {
    let parent: MenuItem | null = null;

    if (createDto.parentId) {
      parent = await this.menuItemRepository.findOne({
        where: { id: createDto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Ítem padre ${createDto.parentId} no encontrado`);
      }
    }

    const menuItem = this.menuItemRepository.create({ ...createDto, parent });
    return await this.menuItemRepository.save(menuItem);
  }

  // ══════════════════════════════════════════════════════════════════
  // OBTENER MENÚ DEL USUARIO AUTENTICADO
  //
  // ✅ FIX: el controller usaba getMenuForRole(user.role), lo que
  //    ignoraba los permisos exactos del JWT y dependía solo del rol.
  //    Este método usa los permisos reales del token.
  // ══════════════════════════════════════════════════════════════════
  async getMenuForUser(user: JwtPayload): Promise<MenuItem[]> {
    const userPermissions: string[] = user.permissions || [];
    const allItems = await this.menuItemRepository.findTrees();
    return this.filterMenu(allItems, userPermissions);
  }

  // ══════════════════════════════════════════════════════════════════
  // OBTENER MENÚ PARA UN ROL (admin — previsualización)
  // ══════════════════════════════════════════════════════════════════
  async getMenuForRole(roleName: string): Promise<MenuItem[]> {
    const rolePermissions: string[] = (ROLE_PERMISSIONS as any)[roleName] || [];
    const allItems = await this.menuItemRepository.findTrees();
    return this.filterMenu(allItems, rolePermissions);
  }

  private filterMenu(items: MenuItem[], permissions: string[]): MenuItem[] {
    // Validación defensiva: asegurar que items sea un arreglo
    if (!Array.isArray(items)) return [];
    
    // Asegurar que permissions sea un arreglo para evitar error en .includes
    const authPermissions = Array.isArray(permissions) ? permissions : [];

    return items
      .filter(item => item && item.isActive && item.isVisible)
      .filter(item => !item.requiredPermission || authPermissions.includes(item.requiredPermission))
      .map(item => {
        item.children = item.children?.length
          ? this.filterMenu(item.children, authPermissions)
          : [];
        return item;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // ══════════════════════════════════════════════════════════════════
  // TODOS LOS ÍTEMS (admin — gestor de menú)
  // ══════════════════════════════════════════════════════════════════
  async getAllMenuItems(): Promise<MenuItem[]> {
    return await this.menuItemRepository.findTrees();
  }

  async getMenuItem(id: string): Promise<MenuItem> {
    const menuItem = await this.menuItemRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
      order: { order: 'ASC' }
    });
    if (!menuItem) {
      throw new NotFoundException(`Ítem de menú ${id} no encontrado`);
    }
    return menuItem;
  }

  // ══════════════════════════════════════════════════════════════════
  // ACTUALIZAR
  // ══════════════════════════════════════════════════════════════════
  async updateMenuItem(id: string, updateDto: UpdateMenuDto): Promise<MenuItem> {
    const menuItem = await this.getMenuItem(id);

    if (updateDto.parentId) {
      if (updateDto.parentId === id) {
        throw new BadRequestException('Un ítem no puede ser padre de sí mismo');
      }
      const parent = await this.menuItemRepository.findOne({
        where: { id: updateDto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Ítem padre ${updateDto.parentId} no encontrado`);
      }
      menuItem.parent = parent;
    } else if (updateDto.parentId === null || updateDto.parentId === '') {
      // Mover a raíz
      menuItem.parent = null;
    }

    Object.assign(menuItem, updateDto);
    return await this.menuItemRepository.save(menuItem);
  }

  async toggleMenuItemStatus(id: string, isActive: boolean): Promise<MenuItem> {
    const menuItem = await this.getMenuItem(id);
    menuItem.isActive = isActive;
    return await this.menuItemRepository.save(menuItem);
  }

  async toggleMenuItemVisibility(id: string, isVisible: boolean): Promise<MenuItem> {
    const menuItem = await this.getMenuItem(id);
    menuItem.isVisible = isVisible;
    return await this.menuItemRepository.save(menuItem);
  }

  // ══════════════════════════════════════════════════════════════════
  // ELIMINAR
  // ══════════════════════════════════════════════════════════════════
  async deleteMenuItem(id: string): Promise<void> {
    const menuItem = await this.getMenuItem(id);
    const descendants = await this.menuItemRepository.findDescendants(menuItem);

    // descendants incluye al propio ítem, por eso > 1
    if (descendants.length > 1) {
      throw new BadRequestException(
        'No se puede eliminar un ítem que tiene sub-ítems. Elimine los hijos primero.',
      );
    }

    await this.menuItemRepository.remove(menuItem);
  }

  // ══════════════════════════════════════════════════════════════════
  // REORDENAR
  //
  // ✅ FIX: la versión anterior usaba el índice del array directamente
  //    sobre todos los ítems mezclados. Ahora asigna el `order` según
  //    la posición dentro del array recibido, actualizando solo esos IDs.
  // ══════════════════════════════════════════════════════════════════
  async reorderMenuItems(orderedIds: string[]): Promise<MenuItem[]> {
    if (!orderedIds?.length) return this.getAllMenuItems();

    // Cargar solo los ítems que se están reordenando
    const menuItems = await this.menuItemRepository.findBy({ id: In(orderedIds) });

    // Crear mapa para asignar el order según la posición recibida
    const orderMap = new Map(orderedIds.map((id, index) => [id, index]));

    const updates = menuItems.map(item => {
      item.order = orderMap.get(item.id) ?? item.order;
      return this.menuItemRepository.save(item);
    });

    await Promise.all(updates);
    return this.getAllMenuItems();
  }

  // ══════════════════════════════════════════════════════════════════
  // SEED (menú por defecto)
  // ══════════════════════════════════════════════════════════════════
  async seedDefaultMenu(): Promise<void> {
    this.logger.log('Iniciando seed del menú por defecto...');

    const existingCount = await this.menuItemRepository.count();
    if (existingCount > 0) {
      this.logger.log('El menú ya existe, omitiendo seed');
      return;
    }

    try {
      await this.createMenuTree(DEFAULT_MENU_ITEMS as Partial<MenuSeedItem>[]);
      this.logger.log('Seed del menú completado exitosamente');
    } catch (error) {
      this.logger.error('Error durante el seed del menú:', error);
      throw error;
    }
  }

  private async createMenuTree(
    items: Partial<MenuSeedItem>[],
    parent?: MenuItem,
  ): Promise<void> {
    for (const itemData of items) {
      const menuItem = this.menuItemRepository.create({ ...itemData, parent });
      const savedItem = await this.menuItemRepository.save(menuItem);
      if (itemData.children?.length) {
        await this.createMenuTree(itemData.children as Partial<MenuSeedItem>[], savedItem);
      }
    }
  }
}