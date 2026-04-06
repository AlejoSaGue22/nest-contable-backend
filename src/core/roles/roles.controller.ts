import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permission } from 'src/common/constants/roles.constants';
import { Permissions } from '../../auth/decorators/roles.decorator';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions/available')
  @Permissions(Permission.ROLE_READ)
  async getAvailablePermissions() {
    const permissions = await this.rolesService.getAvailablePermissions();
    return {
      success: true,
      data: permissions,
      message: 'Permisos disponibles obtenidos exitosamente',
    };
  }

  @Post()
  @Permissions(Permission.ROLE_CREATE)
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.rolesService.create(createRoleDto);
    return {
      success: true,
      data: role,
      message: 'Rol creado exitosamente',
    };
  }

  @Get()
  @Permissions(Permission.ROLE_READ)
  async findAll() {
    const roles = await this.rolesService.findAll();
    return {
      success: true,
      data: roles,
      message: 'Roles obtenidos exitosamente',
    };
  }

  @Get(':id')
  @Permissions(Permission.ROLE_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.rolesService.findOne(id);
    return {
      success: true,
      data: role,
      message: 'Rol obtenido exitosamente',
    };
  }

  @Get('name/:name')
  @Permissions(Permission.ROLE_READ)
  async findByName(@Param('name') name: string) {
    const role = await this.rolesService.findByName(name);
    return {
      success: true,
      data: role,
      message: 'Rol obtenido exitosamente',
    };
  }

  @Patch(':id')
  @Permissions(Permission.ROLE_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    const role = await this.rolesService.update(id, updateRoleDto);
    return {
      success: true,
      data: role,
      message: 'Rol actualizado exitosamente',
    };
  }

  @Delete(':id')
  @Permissions(Permission.ROLE_DELETE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.rolesService.remove(id);
    return {
      success: true,
      message: 'Rol eliminado exitosamente',
    };
  }

  @Post(':id/permissions/:permission')
  @Permissions(Permission.ROLE_UPDATE)
  async addPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permission') permission: Permission,
  ) {
    const role = await this.rolesService.addPermission(id, permission);
    return {
      success: true,
      data: role,
      message: 'Permiso agregado exitosamente',
    };
  }

  @Delete(':id/permissions/:permission')
  @Permissions(Permission.ROLE_UPDATE)
  async removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permission') permission: Permission,
  ) {
    const role = await this.rolesService.removePermission(id, permission);
    return {
      success: true,
      data: role,
      message: 'Permiso removido exitosamente',
    };
  }

  @Post('seed')
  @Permissions(Permission.ROLE_CREATE)
  async seedDefaultRoles() {
    await this.rolesService.seedDefaultRoles();
    return {
      success: true,
      message: 'Roles por defecto creados exitosamente',
    };
  }
}
