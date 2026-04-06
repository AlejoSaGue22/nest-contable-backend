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
import { In, IsNull, TreeRepository } from 'typeorm';
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

    if (!createDto.requiredPermission) {
      createDto.requiredPermission = `menu:auto:${this.generateSlug(createDto.title)}`;
    }

    const menuItem = this.menuItemRepository.create({ ...createDto, parent });
    return await this.menuItemRepository.save(menuItem);
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD') // Quitar acentos
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_') // Caracteres no alfanuméricos a guion bajo
      .replace(/_{2,}/g, '_') // Evitar guiones bajos dobles
      .replace(/^_|_$/g, ''); // Quitar guiones bajos al inicio/final
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

    // console.log(authPermissions);

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
    const allItems = await this.menuItemRepository.findTrees();

    const all = allItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return all;
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
  // SEED / SYNC (menú por defecto)
  //
  // ✅ FIX: ahora no solo inserta si está vacío, sino que sincroniza
  //    los permisos y rutas de los ítems existentes basándose en el título.
  // ══════════════════════════════════════════════════════════════════
  async seedDefaultMenu(): Promise<void> {
    this.logger.log('Iniciando sincronización del menú por defecto...');

    try {
      await this.syncMenuTree(DEFAULT_MENU_ITEMS as Partial<MenuSeedItem>[]);
      this.logger.log('Sincronización del menú completada exitosamente');
    } catch (error) {
      this.logger.error('Error durante la sincronización del menú:', error);
      throw error;
    }
  }

  private async syncMenuTree(items: Partial<MenuSeedItem>[], parent?: MenuItem): Promise<void> {
    for (const itemData of items) {
      const { children, ...data } = itemData;

      // Buscar si ya existe por título y padre para actualizar permisos/rutas
      let menuItem = await this.menuItemRepository.findOne({
        where: { 
          title: data.title,
          parent: parent ? { id: parent.id } : IsNull()
        },
        relations: ['parent']
      });

      if (menuItem) {
        // Actualizar existente (permisos, iconos, rutas, etc. desde constantes)
        if (!data.requiredPermission && !menuItem.requiredPermission) {
          data.requiredPermission = `menu:auto:${this.generateSlug(data.title ?? '')}`;
        }
        Object.assign(menuItem, data);
        menuItem.parent = parent || null;
        menuItem = await this.menuItemRepository.save(menuItem);
      } else {
        // Crear nuevo
        if (!data.requiredPermission) {
          data.requiredPermission = `menu:auto:${this.generateSlug(data.title ?? '')}`;
        }
        menuItem = this.menuItemRepository.create({ ...data, parent });
        menuItem = await this.menuItemRepository.save(menuItem);
        this.logger.log(`Ítem de menú creado: ${data.title}`);
      }

      if (children?.length) {
        await this.syncMenuTree(children as Partial<MenuSeedItem>[], menuItem);
      }
    }
  }
}