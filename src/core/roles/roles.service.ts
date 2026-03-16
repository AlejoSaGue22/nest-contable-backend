import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Repository } from 'typeorm';
import { Permission, ROLE_PERMISSIONS, SystemRole } from 'src/common/constants/roles.constants';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) { }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    // Verificar si el nombre ya existe
    const existingRole = await this.rolesRepository.findOne({
      where: { name: createRoleDto.name },
    });

    if (existingRole) {
      throw new BadRequestException('El nombre del rol ya existe');
    }

    // Crear rol
    const role = this.rolesRepository.create({
      ...createRoleDto,
      isSystem: false, // Los roles creados por usuarios no son del sistema
    });

    return await this.rolesRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return await this.rolesRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }

    return role;
  }

  async findByName(name: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { name },
    });

    if (!role) {
      throw new NotFoundException(`Rol ${name} no encontrado`);
    }

    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);

    // Verificar si es un rol del sistema
    if (role.isSystem) {
      throw new BadRequestException('No se pueden modificar los roles del sistema');
    }

    // Verificar si se está cambiando el nombre
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.rolesRepository.findOne({
        where: { name: updateRoleDto.name },
      });

      if (existingRole) {
        throw new BadRequestException('El nombre del rol ya existe');
      }
    }

    Object.assign(role, updateRoleDto);
    return await this.rolesRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);

    // Verificar si es un rol del sistema
    if (role.isSystem) {
      throw new BadRequestException('No se pueden eliminar los roles del sistema');
    }

    // Verificar si tiene usuarios asignados
    if (role.users && role.users.length > 0) {
      throw new BadRequestException('No se puede eliminar un rol que tiene usuarios asignados');
    }

    await this.rolesRepository.remove(role);
  }


  async addPermission(id: string, permission: Permission): Promise<Role> {
    const role = await this.findOne(id);

    if (role.isSystem) {
      throw new BadRequestException('No se pueden modificar los permisos de roles del sistema');
    }

    if (!role.hasPermission(permission)) {
      role.addPermission(permission);
      return await this.rolesRepository.save(role);
    }

    return role;
  }

  async removePermission(id: string, permission: Permission): Promise<Role> {
    const role = await this.findOne(id);

    if (role.isSystem) {
      throw new BadRequestException('No se pueden modificar los permisos de roles del sistema');
    }

    if (role.hasPermission(permission)) {
      role.removePermission(permission);
      return await this.rolesRepository.save(role);
    }

    return role;
  }

  async seedDefaultRoles(): Promise<void> {
    const defaultRoles = Object.values(SystemRole).map(roleName => ({
      name: roleName,
      description: this.getRoleDescription(roleName),
      permissions: ROLE_PERMISSIONS[roleName] || [],
      isSystem: true,
      isActive: true,
    }));

    // Verificar si ya existen roles
    const existingRoles = await this.rolesRepository.count();
    if (existingRoles > 0) {
      return; // No hacer seed si ya hay datos
    }

    for (const roleData of defaultRoles) {
      const role = this.rolesRepository.create(roleData);
      await this.rolesRepository.save(role);
    }
  }

  private getRoleDescription(roleName: SystemRole): string {
    const descriptions: Record<SystemRole, string> = {
      [SystemRole.SUPER_ADMIN]: 'Acceso completo a todo el sistema',
      [SystemRole.ADMIN]: 'Administrador con acceso a la mayoría de funciones',
      [SystemRole.MANAGER]: 'Gerente con acceso a operaciones y reportes',
      [SystemRole.ACCOUNTANT]: 'Contador con acceso a facturación y reportes',
      [SystemRole.SALES]: 'Vendedor con acceso a clientes y facturación',
      [SystemRole.VIEWER]: 'Solo lectura en la mayoría de módulos',
    };

    return descriptions[roleName] || 'Rol del sistema';
  }


}
