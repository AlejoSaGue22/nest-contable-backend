import { Permission } from "./roles.constants";

export const DEFAULT_MENU_ITEMS = [
      {
        title: 'Dashboard',
        icon: 'dashboard',
        route: '/dashboard',
        requiredPermission: Permission.DASHBOARD_VIEW,
        order: 0,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      {
        title: 'Ventas',
        icon: 'point_of_sale',
        route: '/ventas',
        requiredPermission: Permission.USER_READ,
        order: 5,
        isActive: true,
        isVisible: true,
        metadata: { badge: null },
        children: [
          // CLIENTS
          {
            title: 'Clientes',
            icon: 'people',
            route: '/ventas/clients',
            requiredPermission: Permission.USER_READ,
            order: 0,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          // INVOICES
          {
            title: 'Facturas Venta',
            icon: 'receipt',
            route: '/ventas/comprobantes',
            requiredPermission: Permission.MENU_MANAGE,
            order: 2,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          // PRODUCTS
          {
            title: 'Productos y Servicios',
            icon: 'inventory_2',
            route: '/ventas/products_services',
            requiredPermission: Permission.SETTINGS_VIEW,
            order: 3,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          }
        ],
      },
      {
        title: 'Compras y Gastos',
        icon: 'shopping_cart',
        route: '/purchases',
        requiredPermission: Permission.USER_READ,
        order: 5,
        isActive: true,
        isVisible: true,
        metadata: { badge: null },
        children: [
          // SUPPLIERS
          {
            title: 'Proveedores',
            icon: 'people_outline',
            route: '/purchases/suppliers',
            requiredPermission: Permission.USER_READ,
            order: 0,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          // INVOICES - PURCHASES
          {
            title: 'Facturas compra',
            icon: 'receipt',
            route: '/purchases/invoices',
            requiredPermission: Permission.MENU_MANAGE,
            order: 2,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
        ],
      },
      {
        title: 'Reportes',
        icon: 'assessment',
        route: '/reports',
        requiredPermission: Permission.REPORT_VIEW,
        order: 4,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      {
        title: 'Administración',
        icon: 'admin_panel_settings',
        route: '/admin',
        requiredPermission: Permission.USER_READ,
        order: 5,
        isActive: true,
        isVisible: true,
        metadata: { badge: null },
        children: [
          {
            title: 'Usuarios',
            icon: 'manage_accounts',
            route: '/admin/users',
            requiredPermission: Permission.USER_READ,
            order: 0,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          {
            title: 'Roles',
            icon: 'admin_panel_settings',
            route: '/admin/roles',
            requiredPermission: Permission.ROLE_READ,
            order: 1,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          {
            title: 'Menú',
            icon: 'menu',
            route: '/admin/menu',
            requiredPermission: Permission.MENU_MANAGE,
            order: 2,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          {
            title: 'Configuración',
            icon: 'settings',
            route: '/admin/settings',
            requiredPermission: Permission.SETTINGS_VIEW,
            order: 3,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
        ],
      },
    ];