import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/guard/auth/auth.guard';
import { RolesGuard } from 'src/auth/guard/auth/roles.guard';
import { Permission } from 'src/common/constants/roles.constants';
import { User } from './entities/user.entity';
import { Permissions } from '../auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions(Permission.USER_CREATE)
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    const user = await this.usersService.create(createUserDto, currentUser);
    return {
      success: true,
      data: user,
      message: 'Usuario creado exitosamente',
    };
  }

  @Get()
  @Permissions(Permission.USER_READ)
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    const result = await this.usersService.findAll(
      parseInt(page),
      parseInt(limit),
      search,
    );
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'Usuarios obtenidos exitosamente',
    };
  }

  @Get(':id')
  @Permissions(Permission.USER_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      data: user,
      message: 'Usuario obtenido exitosamente',
    };
  }

  @Get('email/:email')
  @Permissions(Permission.USER_READ)
  async findByEmail(@Param('email') email: string) {
    const user = await this.usersService.findByEmail(email);
    return {
      success: true,
      data: user,
      message: 'Usuario obtenido exitosamente',
    };
  }

  @Patch(':id')
  @Permissions(Permission.USER_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    const user = await this.usersService.update(id, updateUserDto, currentUser);
    return {
      success: true,
      data: user,
      message: 'Usuario actualizado exitosamente',
    };
  }

  @Delete(':id')
  @Permissions(Permission.USER_DELETE)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.usersService.remove(id, currentUser);
    return {
      success: true,
      message: 'Usuario eliminado exitosamente',
    };
  }

  @Patch(':id/toggle-status')
  @Permissions(Permission.USER_UPDATE)
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() currentUser: User,
  ) {
    const user = await this.usersService.toggleStatus(id, isActive, currentUser);
    return {
      success: true,
      data: user,
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} exitosamente`,
    };
  }

  @Get('role/:roleId')
  @Permissions(Permission.USER_READ)
  async getUsersByRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    const users = await this.usersService.getUsersByRole(roleId);
    return {
      success: true,
      data: users,
      message: 'Usuarios por rol obtenidos exitosamente',
    };
  }

  @Get('count/total')
  @Permissions(Permission.USER_READ)
  async countUsers() {
    const count = await this.usersService.countUsers();
    return {
      success: true,
      data: { count },
      message: 'Conteo de usuarios obtenido exitosamente',
    };
  }


}
