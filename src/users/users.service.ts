import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from 'src/core/roles/entities/role.entity';
import { SystemRole } from 'src/common/constants/roles.constants';
import * as bcryptjs from 'bcryptjs';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) { }

  async create(createUserDto: CreateUserDto, currentUser: User): Promise<User> {
    // Verificar si el email ya existe
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('El email ya está registrado');
    }

    // Verificar rol
    const role = await this.rolesRepository.findOne({
      where: { id: createUserDto.roleId },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    // Verificar permisos (no se puede asignar un rol superior al propio)
    const currentUserRole = await this.rolesRepository.findOne({
      where: { id: currentUser.roleId },
    });

    if (currentUserRole?.name !== SystemRole.SUPER_ADMIN && role.name === SystemRole.SUPER_ADMIN) {
      throw new BadRequestException('No tienes permisos para crear un Super Admin');
    }

    // Crear usuario
    const hashedPassword = await bcryptjs.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      role,
      isActive: true,
    });

    return await this.usersRepository.save(user);
  }

  async save(createUserDto: CreateUserDto) {
    return await this.usersRepository.save(createUserDto);
  }

  async findAll(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.isActive = :isActive', { isActive: true });

    if (search) {
      queryBuilder.andWhere(
        '(user.email LIKE :search OR user.name LIKE :search OR role.name LIKE :search)',
        { search: `%${search}%` }
      );
    }

    queryBuilder.orderBy('user.createdAt', 'DESC').skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con email ${email} no encontrado`);
    }

    return user;
  }

  async findOneEmailWithPassword(email: string) {

    const user = await this.usersRepository.findOne({
      where: { email },
      select: ['id', 'fullName', 'email', 'password'],
      relations: ['role']
    });

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: User): Promise<User> {
    const user = await this.findOne(id);

    // Verificar si se está actualizando el rol
    if (updateUserDto.roleId && updateUserDto.roleId !== user.roleId) {
      const newRole = await this.rolesRepository.findOne({
        where: { id: updateUserDto.roleId },
      });

      if (!newRole) {
        throw new NotFoundException('Rol no encontrado');
      }

      // Verificar permisos
      const currentUserRole = await this.rolesRepository.findOne({
        where: { id: currentUser.roleId },
      });

      if (currentUserRole?.name !== SystemRole.SUPER_ADMIN && newRole.name === SystemRole.SUPER_ADMIN) {
        throw new BadRequestException('No tienes permisos para asignar el rol Super Admin');
      }

      user.role = newRole;
    }

    // Actualizar otros campos
    Object.assign(user, updateUserDto);

    // Si se actualiza la contraseña
    if (updateUserDto.password) {
      user.password = await bcryptjs.hash(updateUserDto.password, 10);
    }

    return await this.usersRepository.save(user);
  }

  async remove(id: string, currentUser: User): Promise<void> {
    if (id === currentUser.id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }

    const user = await this.findOne(id);

    // Verificar si es un usuario del sistema
    const userRole = await this.rolesRepository.findOne({
      where: { id: user.roleId },
    });

    if (userRole?.name === SystemRole.SUPER_ADMIN) {
      throw new BadRequestException('No puedes eliminar un Super Admin');
    }

    // Soft delete
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async toggleStatus(id: string, isActive: boolean, currentUser: User): Promise<User> {
    if (id === currentUser.id && !isActive) {
      throw new BadRequestException('No puedes desactivar tu propio usuario');
    }

    const user = await this.findOne(id);
    user.isActive = isActive;

    return await this.usersRepository.save(user);
  }

  async getUsersByRole(roleId: string): Promise<User[]> {
    return await this.usersRepository.find({
      where: { roleId, isActive: true },
      relations: ['role'],
    });
  }

  async countUsers(): Promise<number> {
    return await this.usersRepository.count({ where: { isActive: true } });
  }
}
