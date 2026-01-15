import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu.entity';
import { In, TreeRepository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
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
  
  async getMenuForUser(user: JwtPayload): Promise<MenuSeedItem[]> {
    // El user viene del JWT payload, no es una instancia de User entity
    const userPermissions = user.permissions || [];
    console.log("userPermissions", userPermissions);  
    
    // Obtener todos los items activos
    const allItems = await this.menuItemRepository.findTrees();
    console.log("allItems", allItems);
    // Filtrar según permisos y visibilidad
    const filterMenu = (items: MenuSeedItem[]): MenuSeedItem[] => {
      return items
        .filter(item => item.isActive && item.isVisible)
        .filter(item => !item.requiredPermission || userPermissions.includes(item.requiredPermission))
        .map(item => ({
          ...item,
          children: item.children ? filterMenu(item.children) : [],
        }))
        .sort((a, b) => a.order - b.order);
    };

    return filterMenu(allItems);
  }

  async getMenuForRole(roleName: string): Promise<MenuSeedItem[]> {
    // Obtener permisos del rol
    const rolePermissions = ROLE_PERMISSIONS[roleName as any] || [];
    
    const allItems = await this.menuItemRepository.findTrees();
    
    const filterMenu = (items: MenuSeedItem[]): MenuSeedItem[] => {
      return items
        .filter(item => item.isActive && item.isVisible)
        .filter(item => !item.requiredPermission || rolePermissions.includes(item.requiredPermission))
        .map(item => ({
          ...item,
          children: item.children ? filterMenu(item.children) : [],
        }))
        .sort((a, b) => a.order - b.order);
    };

    return filterMenu(allItems);
  }

  async getAllMenuItems(): Promise<MenuItem[]> {
    return await this.menuItemRepository.findTrees({
      // order: { order: 'ASC' },
    });
  }

  async getMenuItem(id: string): Promise<MenuItem> {
    const menuItem = await this.menuItemRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!menuItem) {
      throw new NotFoundException(`Menu item con ID ${id} no encontrado`);
    }

    return menuItem;
  }

  // ***! QUEDA PENDIENTE SOLUCIONAR YA QUE ARROJA UN ERROR */

  // async createMenuItem(createDto: CreateMenuDto): Promise<MenuSeedItem> {
  //   let parent: MenuSeedItem | null = null;
    
  //   if (createDto.parentId) {
  //     parent = await this.menuItemRepository.findOne({
  //       where: { id: createDto.parentId },
  //     });
      
  //     if (!parent) {
  //       throw new NotFoundException(`Menu item padre con ID ${createDto.parentId} no encontrado`);
  //     }
  //   }

  //   const menuItem = this.menuItemRepository.create({
  //     ...createDto,
  //     parent,
  //   });

  //   return await this.menuItemRepository.save(menuItem);
  // }

  async updateMenuItem(id: string, updateDto: UpdateMenuDto): Promise<MenuItem> {
    const menuItem = await this.getMenuItem(id);
    
    if (updateDto.parentId) {
      if (updateDto.parentId === id) {
        throw new BadRequestException('Un item no puede ser padre de sí mismo');
      }
      
      const parent = await this.menuItemRepository.findOne({
        where: { id: updateDto.parentId },
      });
      
      if (!parent) {
        throw new NotFoundException(`Menu item padre con ID ${updateDto.parentId} no encontrado`);
      }
      
      menuItem.parent = parent;
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

  async deleteMenuItem(id: string): Promise<void> {
    const menuItem = await this.getMenuItem(id);
    
    // Verificar si tiene hijos
    const children = await this.menuItemRepository.findDescendants(menuItem);
    if (children.length > 1) { // Incluye al padre
      throw new BadRequestException('No se puede eliminar un item que tiene hijos. Elimine los hijos primero.');
    }
    
    await this.menuItemRepository.remove(menuItem);
  }

  async reorderMenuItems(orderedIds: string[]): Promise<MenuItem[]> {
    const menuItems = await this.menuItemRepository.findBy({
      id: In(orderedIds),
    });
    
    const updatePromises = menuItems.map((item, index) => {
      item.order = index;
      return this.menuItemRepository.save(item);
    });
    
    await Promise.all(updatePromises);
    
    return this.getAllMenuItems();
  }

   async seedDefaultMenu(): Promise<void> {
    this.logger.log('Iniciando seed del menú por defecto...');
    
    // Verificar si ya existe menú
    const existingMenu = await this.menuItemRepository.count();
    
    if (existingMenu > 0) {
      this.logger.log('El menú ya existe, omitiendo seed');
      return;
    }

    const defaultMenu: Partial<MenuSeedItem>[] = DEFAULT_MENU_ITEMS; 

    try {
      await this.createMenuTree(defaultMenu);
      this.logger.log('Seed del menú completado exitosamente');
    } catch (error) {
      this.logger.error('Error durante el seed del menú:', error);
      throw error;
    }
  }

  private async createMenuTree(items: Partial<MenuSeedItem>[], parent?: MenuSeedItem): Promise<void> {
    for (const itemData of items) {
      const menuItem = this.menuItemRepository.create({
        ...itemData,
        parent,
      });

      const savedItem = await this.menuItemRepository.save(menuItem);

      if (itemData.children) {
        await this.createMenuTree(itemData.children, savedItem);
      }
    }
  }
}
