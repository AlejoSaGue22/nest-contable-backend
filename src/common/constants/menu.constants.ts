import { Permission } from "./roles.constants";

export const DEFAULT_MENU_ITEMS = [
      {
        title: 'Dashboard',
        icon: '<i class="fa-solid fa-chart-simple"></i>',
        route: '/dashboard',
        requiredPermission: Permission.DASHBOARD_VIEW,
        order: 0,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      {
        title: 'Ventas',
        icon: '<i class="fa-solid fa-hand-holding-dollar"></i>',
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
        icon: '<i class="fa-solid fa-cart-shopping"></i>',
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
        icon: '<i class="fa-solid fa-chart-line"></i>',
        route: '/reports',
        requiredPermission: Permission.REPORT_VIEW,
        order: 4,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      {
        title: 'Administración',
        icon: '<i class="fa-solid fa-admin_panel_settings"></i>',
        route: '/admin',
        requiredPermission: Permission.USER_READ,
        order: 5,
        isActive: true,
        isVisible: true,
        metadata: { badge: null },
        children: [
          {
            title: 'Usuarios',
            icon: '<i class="fa-solid fa-manage_accounts"></i>',
            route: '/admin/users',
            requiredPermission: Permission.USER_READ,
            order: 0,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          {
            title: 'Roles',
            icon: '<i class="fa-solid fa-admin_panel_settings"></i>',
            route: '/admin/roles',
            requiredPermission: Permission.ROLE_READ,
            order: 1,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          {
            title: 'Menú',
            icon: '<i class="fa-solid fa-menu"></i>',
            route: '/admin/menu',
            requiredPermission: Permission.MENU_MANAGE,
            order: 2,
            isActive: true,
            isVisible: true,
            metadata: { badge: null }
          },
          {
            title: 'Configuración',
            icon: '<i class="fa-solid fa-settings"></i>',
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