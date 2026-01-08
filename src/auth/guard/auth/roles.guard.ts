import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { PERMISSIONS_KEY, ROLES_KEY } from 'src/auth/decorators/roles.decorator';
import { Permission, ROLE_PERMISSIONS, UserRole } from 'src/common/constants/roles.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay permisos ni roles requeridos, permitir acceso
    if (!requiredPermissions && !requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    console.log("User Roles Guard: ", user);

    // Verificar roles si se especifican
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some(role => user.role === role);
      if (!hasRole) {
        throw new ForbiddenException('No tiene el rol necesario para esta acción');
      }
    }

    // Verificar permisos si se especifican
    if (requiredPermissions && requiredPermissions.length > 0) {
        const userPermissions = ROLE_PERMISSIONS[user.role] || [];
        const hasPermission = requiredPermissions.some(permission => 
            userPermissions.includes(permission)
        );

        if (!hasPermission) {
            throw new ForbiddenException('No tiene permisos para realizar esta acción');
        }
    }

    return true;
  }
}