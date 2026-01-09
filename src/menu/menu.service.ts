import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MenuItem } from './entities/menu.entity';
import { TreeRepository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Permission } from 'src/common/constants/roles.constants';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private menuItemRepository: TreeRepository<MenuItem>,
  ) {}
  
  async getMenuForUser(user: User): Promise<MenuItem[]> {
    const userPermissions = user.getPermissions();
    
    // Obtener todos los items activos
    const allItems = await this.menuItemRepository.findTrees();
    
    // Filtrar según permisos y visibilidad
    const filterMenu = (items: MenuItem[]): MenuItem[] => {
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

  async getMenuForRole(roleName: string): Promise<MenuItem[]> {
    // Obtener permisos del rol
    const rolePermissions = ROLE_PERMISSIONS[roleName as any] || [];
    
    const allItems = await this.menuItemRepository.findTrees();
    
    const filterMenu = (items: MenuItem[]): MenuItem[] => {
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
      order: { order: 'ASC' },
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

  async createMenuItem(createDto: CreateMenuItemDto): Promise<MenuItem> {
    let parent: MenuItem | null = null;
    
    if (createDto.parentId) {
      parent = await this.menuItemRepository.findOne({
        where: { id: createDto.parentId },
      });
      
      if (!parent) {
        throw new NotFoundException(`Menu item padre con ID ${createDto.parentId} no encontrado`);
      }
    }

    const menuItem = this.menuItemRepository.create({
      ...createDto,
      parent,
    });

    return await this.menuItemRepository.save(menuItem);
  }

  async updateMenuItem(id: string, updateDto: UpdateMenuItemDto): Promise<MenuItem> {
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
    const menuItems = await this.menuItemRepository.findByIds(orderedIds);
    
    const updatePromises = menuItems.map((item, index) => {
      item.order = index;
      return this.menuItemRepository.save(item);
    });
    
    await Promise.all(updatePromises);
    
    return this.getAllMenuItems();
  }

  async seedDefaultMenu(): Promise<void> {
    const defaultMenu: Partial<MenuItem>[] = [
      {
        title: 'Dashboard',
        icon: 'dashboard',
        route: '/dashboard',
        requiredPermission: Permission.DASHBOARD_VIEW,
        order: 0,
        isActive: true,
        isVisible: true,
      },
      {
        title: 'Facturación',
        icon: 'receipt',
        route: '/invoices',
        requiredPermission: Permission.INVOICE_READ,
        order: 1,
        isActive: true,
        isVisible: true,
      },
      {
        title: 'Clientes',
        icon: 'people',
        route: '/clients',
        requiredPermission: Permission.CLIENT_READ,
        order: 2,
        isActive: true,
        isVisible: true,
      },
      {
        title: 'Productos',
        icon: 'inventory',
        route: '/products',
        requiredPermission: Permission.PRODUCT_READ,
        order: 3,
        isActive: true,
        isVisible: true,
      },
      {
        title: 'Reportes',
        icon: 'assessment',
        route: '/reports',
        requiredPermission: Permission.REPORT_VIEW,
        order: 4,
        isActive: true,
        isVisible: true,
      },
      {
        title: 'Administración',
        icon: 'admin_panel_settings',
        route: '/admin',
        requiredPermission: Permission.USER_READ,
        order: 5,
        isActive: true,
        isVisible: true,
        children: [
          {
            title: 'Usuarios',
            icon: 'manage_accounts',
            route: '/admin/users',
            requiredPermission: Permission.USER_READ,
            order: 0,
            isActive: true,
            isVisible: true,
          },
          {
            title: 'Roles',
            icon: 'admin_panel_settings',
            route: '/admin/roles',
            requiredPermission: Permission.ROLE_READ,
            order: 1,
            isActive: true,
            isVisible: true,
          },
          {
            title: 'Menú',
            icon: 'menu',
            route: '/admin/menu',
            requiredPermission: Permission.MENU_MANAGE,
            order: 2,
            isActive: true,
            isVisible: true,
          },
          {
            title: 'Configuración',
            icon: 'settings',
            route: '/admin/settings',
            requiredPermission: Permission.SETTINGS_VIEW,
            order: 3,
            isActive: true,
            isVisible: true,
          },
        ],
      },
    ];

    // Verificar si ya existe menú
    const existingMenu = await this.menuItemRepository.count();
    if (existingMenu > 0) {
      return; // No hacer seed si ya hay datos
    }

    await this.createMenuTree(defaultMenu);
  }

  private async createMenuTree(items: Partial<MenuItem>[], parent?: MenuItem): Promise<void> {
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
