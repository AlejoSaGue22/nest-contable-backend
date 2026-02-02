import { Permission } from "./roles.constants";

export const DEFAULT_MENU_ITEMS = [
  {
    title: 'Dashboard',
    icon: '<i class="fa-solid fa-chart-simple"></i>',
    route: '/panel/dashboard',
    requiredPermission: Permission.DASHBOARD_VIEW,
    order: 0,
    isActive: true,
    isVisible: true,
    other: 'NO',
    metadata: { badge: null }
  },
  {
    title: 'Ventas',
    icon: '<i class="fa-solid fa-hand-holding-dollar"></i>',
    route: '/panel/ventas/clients',
    requiredPermission: Permission.INVOICE_READ,
    order: 1,
    isActive: true,
    isVisible: true,
    other: 'NO',
    metadata: { badge: null },
    children: [
      // CLIENTS
      {
        title: 'Clientes',
        icon: 'people',
        route: '/panel/ventas/clients',
        requiredPermission: Permission.CLIENT_READ,
        order: 0,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      // INVOICES
      {
        title: 'Facturas Venta',
        icon: 'receipt',
        route: '/panel/ventas/comprobantes',
        requiredPermission: Permission.INVOICE_READ,
        order: 2,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      // PRODUCTS
      {
        title: 'Productos y Servicios',
        icon: 'inventory_2',
        route: '/panel/ventas/products_services',
        requiredPermission: Permission.PRODUCT_READ,
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
    route: '/panel/compras/purchases',
    requiredPermission: Permission.INVOICE_READ,
    order: 2,
    isActive: true,
    isVisible: true,
    other: 'NO',
    metadata: { badge: null },
    children: [
      // SUPPLIERS
      {
        title: 'Proveedores',
        icon: 'people_outline',
        route: '/panel/compras/proveedores',
        requiredPermission: Permission.INVOICE_READ,
        order: 0,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      // INVOICES - PURCHASES
      {
        title: 'Facturas compra',
        icon: 'receipt',
        route: '/panel/compras/purchases',
        requiredPermission: Permission.INVOICE_READ,
        order: 2,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      // PRODUCTS PURCHASES
      {
        title: 'Artículos',
        icon: 'inventory_2',
        route: '/panel/compras/articles',
        requiredPermission: Permission.PRODUCT_READ,
        order: 3,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      }
    ],
  },
  {
    title: 'Reportes',
    icon: '<i class="fa-solid fa-chart-line"></i>',
    route: '/panel/reports',
    requiredPermission: Permission.REPORT_VIEW,
    order: 4,
    isActive: true,
    isVisible: true,
    other: 'SI',
    metadata: { badge: null }
  },
  {
    title: 'Administración',
    icon: '<i class="fa-solid fa-user-gear"></i>',
    route: '/panel/admin',
    requiredPermission: Permission.USER_MANAGE,
    order: 5,
    isActive: true,
    isVisible: true,
    other: 'SI',
    metadata: { badge: null },
    children: [
      {
        title: 'Usuarios',
        icon: '<i class="fa-solid fa-manage_accounts"></i>',
        route: '/panel/admin/users',
        requiredPermission: Permission.USER_MANAGE,
        order: 0,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      {
        title: 'Roles',
        icon: '<i class="fa-solid fa-shield"></i>',
        route: '/panel/admin/roles',
        requiredPermission: Permission.ROLE_READ,
        order: 1,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      {
        title: 'Gestion Menú',
        icon: '<i class="fa-solid fa-menu"></i>',
        route: '/panel/admin/menu',
        requiredPermission: Permission.MENU_MANAGE,
        order: 2,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
      {
        title: 'Configuración',
        icon: '<i class="fa-solid fa-settings"></i>',
        route: '/panel/admin/settings',
        requiredPermission: Permission.SETTINGS_VIEW,
        order: 3,
        isActive: true,
        isVisible: true,
        metadata: { badge: null }
      },
    ],
  },
];