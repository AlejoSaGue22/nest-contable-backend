

// export enum SystemRole {
//   SUPER_ADMIN = 'super_admin', // Super Admin
//   ADMIN = 'admin', // Administrador
//   MANAGER = 'manager', // Gerente
//   ACCOUNTANT = 'accountant', // Contador
//   SALES = 'sales', // Vendedor
//   VIEWER = 'viewer' // Observador
// }

export enum SystemRole {
  SUPER_ADMIN = 'Super Admin',
  ADMIN = 'Administrador',
  MANAGER = 'Gerente',
  ACCOUNTANT = 'Contador',
  SALES = 'Vendedor',
  VIEWER = 'Observador',
}

export enum Permission {
  // Dashboard
  DASHBOARD_VIEW = 'dashboard:view',

  // Facturas - Invoices
  INVOICE_CREATE = 'invoice:create',
  INVOICE_READ = 'invoice:read',
  INVOICE_UPDATE = 'invoice:update',
  INVOICE_DELETE = 'invoice:delete',
  INVOICE_EXPORT = 'invoice:export',
  INVOICE_CANCEL = 'invoice:cancel',

  // Clients
  CLIENT_CREATE = 'client:create',
  CLIENT_READ = 'client:read',
  CLIENT_UPDATE = 'client:update',
  CLIENT_DELETE = 'client:delete',

  // Products
  PRODUCT_CREATE = 'product:create',
  PRODUCT_READ = 'product:read',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',

  // Reportes - Reports
  REPORT_READ = 'report:read',
  REPORT_EXPORT = 'report:export',
  REPORT_VIEW = 'report:view',

  // Purchases 
  PURCHASE_CREATE = 'purchase:create',
  PURCHASE_READ = 'purchase:read',
  PURCHASE_UPDATE = 'purchase:update',
  PURCHASE_DELETE = 'purchase:delete',
  PURCHASE_EXPORT = 'purchase:export',

  // Products Purchase  
  PRODUCT_PURCHASE_CREATE = 'product_purchase:create',
  PRODUCT_PURCHASE_READ = 'product_purchase:read',
  PRODUCT_PURCHASE_UPDATE = 'product_purchase:update',
  PRODUCT_PURCHASE_DELETE = 'product_purchase:delete',
  PRODUCT_PURCHASE_EXPORT = 'product_purchase:export',

  // Providers
  PROVIDER_CREATE = 'provider:create',
  PROVIDER_READ = 'provider:read',
  PROVIDER_UPDATE = 'provider:update',
  PROVIDER_DELETE = 'provider:delete',
  PROVIDER_EXPORT = 'provider:export',

  // Payments
  PAGO_READ = 'pago:read',
  PAGO_CREATE = 'pago:create',
  PAGO_UPDATE = 'pago:update',
  PAGO_DELETE = 'pago:delete',
  PAGO_EXPORT = 'pago:export',

  // Users
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Roles
  ROLE_CREATE = 'role:create',
  ROLE_READ = 'role:read',
  ROLE_UPDATE = 'role:update',
  ROLE_DELETE = 'role:delete',

  // System
  USER_MANAGE = 'user:manage',
  ROLE_MANAGE = 'role:manage',
  SETTINGS_MANAGE = 'settings:manage',

  // Settings
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_UPDATE = 'settings:update',

  // Menu
  MENU_MANAGE = 'menu:manage',

  // Contabilidad
  ACCOUNTING_VIEW = 'accounting:view',
  ACCOUNTING_MANAGE = 'accounting:manage',

  // Nómina
  NOMINA_ACCESS = 'nomina:access',
  NOMINA_EMPLOYEE_CREATE = 'nomina:employee_create',
  NOMINA_EMPLOYEE_READ = 'nomina:employee_read',
  NOMINA_EMPLOYEE_UPDATE = 'nomina:employee_update',
  NOMINA_EMPLOYEE_DELETE = 'nomina:employee_delete',
  NOMINA_PERIOD_CREATE = 'nomina:period_create',
  NOMINA_PERIOD_READ = 'nomina:period_read',
  NOMINA_PERIOD_LIQUIDATE = 'nomina:period_liquidate',
  NOMINA_PERIOD_PAY = 'nomina:period_pay',
  NOMINA_PERIOD_ANUL = 'nomina:period_anul',
  NOMINA_DIAN_SEND = 'nomina:dian_send',
  NOMINA_REPORT_READ = 'nomina:report_read',

  // Activos Fijos
  FIXED_ASSETS_CREATE = 'fixed_assets:create',
  FIXED_ASSETS_READ = 'fixed_assets:read',
  FIXED_ASSETS_UPDATE = 'fixed_assets:update',
  FIXED_ASSETS_DELETE = 'fixed_assets:delete',
  FIXED_ASSETS_DEPRECIATE = 'fixed_assets:depreciate',
}

export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  [SystemRole.SUPER_ADMIN]: Object.values(Permission),
  [SystemRole.ADMIN]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE,
    Permission.INVOICE_DELETE, Permission.INVOICE_EXPORT, Permission.INVOICE_CANCEL,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE, Permission.CLIENT_DELETE,
    Permission.PRODUCT_CREATE, Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE, Permission.PRODUCT_DELETE,
    Permission.PURCHASE_CREATE, Permission.PURCHASE_READ, Permission.PURCHASE_UPDATE, Permission.PURCHASE_DELETE, Permission.PURCHASE_EXPORT,
    Permission.PROVIDER_CREATE, Permission.PROVIDER_READ, Permission.PROVIDER_UPDATE, Permission.PROVIDER_DELETE, Permission.PROVIDER_EXPORT,
    Permission.PRODUCT_PURCHASE_CREATE, Permission.PRODUCT_PURCHASE_READ, Permission.PRODUCT_PURCHASE_UPDATE, Permission.PRODUCT_PURCHASE_DELETE, Permission.PRODUCT_PURCHASE_EXPORT,
    Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_MANAGE,
    Permission.REPORT_VIEW, Permission.REPORT_EXPORT,Permission.PAGO_READ, Permission.PAGO_CREATE, Permission.PAGO_UPDATE,
    Permission.PAGO_DELETE, Permission.PAGO_EXPORT,Permission.SETTINGS_VIEW, Permission.SETTINGS_UPDATE,
    Permission.ACCOUNTING_VIEW, Permission.ACCOUNTING_MANAGE,
    Permission.NOMINA_ACCESS, Permission.NOMINA_EMPLOYEE_CREATE, Permission.NOMINA_EMPLOYEE_READ,
    Permission.NOMINA_EMPLOYEE_UPDATE, Permission.NOMINA_EMPLOYEE_DELETE,
    Permission.NOMINA_PERIOD_CREATE, Permission.NOMINA_PERIOD_READ, Permission.NOMINA_PERIOD_LIQUIDATE,
    Permission.NOMINA_PERIOD_PAY, Permission.NOMINA_PERIOD_ANUL,
    Permission.NOMINA_DIAN_SEND,
    Permission.NOMINA_REPORT_READ,
    Permission.FIXED_ASSETS_CREATE,
    Permission.FIXED_ASSETS_READ,
    Permission.FIXED_ASSETS_UPDATE,
    Permission.FIXED_ASSETS_DELETE,
    Permission.FIXED_ASSETS_DEPRECIATE,
  ],
  [SystemRole.MANAGER]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE, Permission.INVOICE_EXPORT,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE,
    Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE,
    Permission.PURCHASE_CREATE, Permission.PURCHASE_READ, Permission.PURCHASE_UPDATE, Permission.PURCHASE_DELETE, Permission.PURCHASE_EXPORT,
    Permission.PROVIDER_CREATE, Permission.PROVIDER_READ, Permission.PROVIDER_UPDATE, Permission.PROVIDER_DELETE, Permission.PROVIDER_EXPORT,
    Permission.PRODUCT_PURCHASE_CREATE, Permission.PRODUCT_PURCHASE_READ, Permission.PRODUCT_PURCHASE_UPDATE, Permission.PRODUCT_PURCHASE_DELETE, Permission.PRODUCT_PURCHASE_EXPORT,
    Permission.REPORT_VIEW, Permission.REPORT_EXPORT,
    Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE, Permission.USER_MANAGE, Permission.PAGO_READ, 
    Permission.PAGO_CREATE, Permission.PAGO_UPDATE, Permission.PAGO_DELETE, Permission.PAGO_EXPORT,
    Permission.ACCOUNTING_VIEW,
  ],
  [SystemRole.ACCOUNTANT]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_READ, Permission.INVOICE_EXPORT,
    Permission.PURCHASE_READ, Permission.PURCHASE_EXPORT,
    Permission.PROVIDER_READ, Permission.PROVIDER_EXPORT,
    Permission.PRODUCT_READ, Permission.PRODUCT_PURCHASE_READ,
    Permission.REPORT_VIEW, Permission.REPORT_EXPORT,
    Permission.PAGO_READ, Permission.PAGO_CREATE, Permission.PAGO_UPDATE, 
    Permission.PAGO_DELETE, Permission.PAGO_EXPORT,
    Permission.ACCOUNTING_VIEW, Permission.ACCOUNTING_MANAGE,
    Permission.CLIENT_READ,
    Permission.FIXED_ASSETS_READ,
    Permission.FIXED_ASSETS_DEPRECIATE,
  ],
  [SystemRole.SALES]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ,
    Permission.PRODUCT_READ, Permission.PROVIDER_READ
  ],
  [SystemRole.VIEWER]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_READ,
    Permission.PURCHASE_READ,
    Permission.CLIENT_READ,
    Permission.PRODUCT_READ,
    Permission.REPORT_VIEW,
  ],
};