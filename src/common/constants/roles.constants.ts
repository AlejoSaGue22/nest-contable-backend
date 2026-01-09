

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  ACCOUNTANT = 'accountant',
  SALES = 'sales',
  VIEWER = 'viewer'
}

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
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE, 
    Permission.INVOICE_DELETE, Permission.INVOICE_EXPORT, Permission.INVOICE_CANCEL,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE, Permission.CLIENT_DELETE,
    Permission.PRODUCT_CREATE, Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE, Permission.PRODUCT_DELETE,
    Permission.REPORT_VIEW, Permission.REPORT_EXPORT,
    Permission.USER_CREATE, Permission.USER_READ, Permission.USER_UPDATE,
    Permission.SETTINGS_VIEW, Permission.SETTINGS_UPDATE,
  ],
  [UserRole.MANAGER]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE, Permission.INVOICE_EXPORT,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE,
    Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE,
    Permission.REPORT_VIEW, Permission.REPORT_EXPORT,
  ],
  [UserRole.ACCOUNTANT]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_READ, Permission.INVOICE_EXPORT,
    Permission.CLIENT_READ,
    Permission.PRODUCT_READ,
    Permission.REPORT_VIEW, Permission.REPORT_EXPORT,
  ],
  [UserRole.SALES]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ,
    Permission.PRODUCT_READ,
  ],
  [UserRole.VIEWER]: [
    Permission.DASHBOARD_VIEW,
    Permission.INVOICE_READ,
    Permission.CLIENT_READ,
    Permission.PRODUCT_READ,
    Permission.REPORT_VIEW,
  ],
};