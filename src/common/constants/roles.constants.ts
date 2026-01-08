

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  ACCOUNTANT = 'accountant',
  SALES = 'sales',
  VIEWER = 'viewer'
}

export enum Permission {
    // Facturas - Invoices
    INVOICE_CREATE = 'invoice:create',
    INVOICE_READ = 'invoice:read',
    INVOICE_UPDATE = 'invoice:update',
    INVOICE_DELETE = 'invoice:delete',
    INVOICE_EXPORT = 'invoice:export',
    
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
    
    // System
    USER_MANAGE = 'user:manage',
    ROLE_MANAGE = 'role:manage',
    SETTINGS_MANAGE = 'settings:manage'
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE, Permission.INVOICE_EXPORT,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE, Permission.CLIENT_DELETE,
    Permission.PRODUCT_CREATE, Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE, Permission.PRODUCT_DELETE,
    Permission.REPORT_READ, Permission.REPORT_EXPORT,
    Permission.USER_MANAGE
  ],
  [UserRole.MANAGER]: [
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE, Permission.INVOICE_EXPORT,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE,
    Permission.PRODUCT_READ, Permission.PRODUCT_UPDATE,
    Permission.REPORT_READ, Permission.REPORT_EXPORT
  ],
  [UserRole.ACCOUNTANT]: [
    Permission.INVOICE_READ, Permission.INVOICE_EXPORT,
    Permission.CLIENT_READ,
    Permission.PRODUCT_READ,
    Permission.REPORT_READ, Permission.REPORT_EXPORT
  ],
  [UserRole.SALES]: [
    Permission.INVOICE_CREATE, Permission.INVOICE_READ,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ,
    Permission.PRODUCT_READ
  ],
  [UserRole.VIEWER]: [
    Permission.INVOICE_READ,
    Permission.CLIENT_READ,
    Permission.PRODUCT_READ,
    Permission.REPORT_READ
  ]
};