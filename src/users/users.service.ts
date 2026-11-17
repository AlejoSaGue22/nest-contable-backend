import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from 'src/core/roles/entities/role.entity';
import { SystemRole } from 'src/common/constants/roles.constants';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { UserEmpresa } from './entities/user-empresa.entity';
import { Municipality } from 'src/core/municipalities/entities/municipality.entity';
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
      where: { id: createUserDto.role },
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
      fullName: `${createUserDto.firstName} ${createUserDto.lastName}`,
      password: hashedPassword,
      role,
      isActive: createUserDto.isActive ?? true,
    });

    return await this.usersRepository.save(user);
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
    if (updateUserDto.role && updateUserDto.role !== user.roleId) {
      const newRole = await this.rolesRepository.findOne({
        where: { id: updateUserDto.role },
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

  async seedDefaultAdminUser(): Promise<void> {
    const manager = this.usersRepository.manager;
    const roleRepo = manager.getRepository(Role);
    const empresaRepo = manager.getRepository(Empresa);
    const userEmpresaRepo = manager.getRepository(UserEmpresa);
    const munRepo = manager.getRepository(Municipality);

    // 1. Obtener o crear Empresa Demo
    let empresa = await empresaRepo.findOne({ where: { nit: '901234567-8' } });
    if (!empresa) {
      let ciudadId = 11001;
      const primerMun = await munRepo.findOne({ where: { code: '11001' } });
      if (primerMun) ciudadId = primerMun.id;

      empresa = await empresaRepo.save(
        empresaRepo.create({
          nit: '901234567-8',
          razonSocial: 'Empresa Demo Colombia S.A.S.',
          direccion: 'Calle 100 # 15-20, Piso 5, Bogotá D.C.',
          telefono: '6013001234',
          email: 'contacto@democolombia.com',
          ciudad: ciudadId,
        }),
      );
      console.log(`🏢 Empresa demo configurada: ${empresa.razonSocial}`);
    }

    // 2. Obtener rol de Administrador
    let adminRole = await roleRepo.findOne({ where: { name: SystemRole.SUPER_ADMIN } });
    if (!adminRole) {
      adminRole = await roleRepo.findOne({ where: { name: SystemRole.ADMIN } });
    }
    if (!adminRole) {
      adminRole = await roleRepo.save(
        roleRepo.create({
          name: SystemRole.ADMIN,
          description: 'Administrador del sistema con acceso total',
          isSystem: true,
          isActive: true,
        }),
      );
    }

    // 3. Obtener o crear Usuario Admin
    const hashedPassword = await bcryptjs.hash('Demo1234*', 10);
    let adminUser = await this.usersRepository.findOne({
      where: { email: 'admin@demo.com' },
      select: ['id', 'email', 'password', 'isActive', 'empresaId', 'roleId'],
    });

    if (!adminUser) {
      adminUser = await this.usersRepository.save(
        this.usersRepository.create({
          fullName: 'Administrador Demo',
          email: 'admin@demo.com',
          password: hashedPassword,
          phone: '3001234567',
          isActive: true,
          roleId: adminRole.id,
          empresaId: empresa.id,
        }),
      );
      console.log(`👤 Usuario demo creado: ${adminUser.email}`);
    } else {
      adminUser.password = hashedPassword;
      adminUser.empresaId = empresa.id;
      adminUser.roleId = adminRole.id;
      adminUser.isActive = true;
      await this.usersRepository.save(adminUser);
      console.log(`👤 Usuario demo verificado/actualizado: ${adminUser.email}`);
    }

    // 4. Vincular en user_empresas
    const userEmpresaExists = await userEmpresaRepo.findOne({
      where: { userId: adminUser.id, empresaId: empresa.id },
    });
    if (!userEmpresaExists) {
      await userEmpresaRepo.save(
        userEmpresaRepo.create({
          userId: adminUser.id,
          empresaId: empresa.id,
          isDefault: true,
        }),
      );
    }
  }
}
