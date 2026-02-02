import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RegisteAuthDto } from './dto/register-dto';
import { LoginAuthDto } from './dto/login-dto';
import * as bcryptjs from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from 'src/users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/roles/entities/role.entity';
import { Repository } from 'typeorm';
import { UserRole } from 'src/common/constants/roles.constants';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    private readonly jwtService: JwtService
  ) { }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: ['role'],
      select: ['id', 'email', 'fullName', 'password', 'role', 'roleId', 'isActive', 'lastLogin'],
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new BadRequestException('Usuario inactivo');
    }

    console.log("User password", user.password);
    console.log("Password", password);
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    console.log("Password valid", isPasswordValid);
    if (!isPasswordValid) {
      throw new BadRequestException('Credenciales incorrectas');
    }

    return user;
  }

  async login(createAuthDto: LoginAuthDto) {
    try {
      const { email, password } = createAuthDto;

      // Actualizar último login
      const user = await this.validateUser(email, password);

      user.lastLogin = new Date();
      await this.usersRepository.save(user);

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        name: user.fullName,
        role: user.role.name as UserRole,
        permissions: user.role.permissions,
      };

      const token = this.jwtService.sign(payload);

      return {
        token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role.name,
          permissions: user.role.permissions,
          lastLogin: user.lastLogin,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Error al iniciar sesión: ${error.message}`);
    }
  }

  async register(createAuthDto: RegisteAuthDto) {

    const { email, password, fullname } = createAuthDto;
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) throw new BadRequestException('Usuario ya se encuentra registrado');

    // Obtener rol por defecto (Viewer)
    const defaultRole = await this.rolesRepository.findOne({
      where: { name: UserRole.VIEWER },
    });

    if (!defaultRole) {
      throw new NotFoundException('Rol por defecto no encontrado');
    }
    // Crear usuario
    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = this.usersRepository.create({
      ...createAuthDto,
      password: hashedPassword,
      role: defaultRole,
      isActive: true,
    });

    await this.usersRepository.save(user);

    // Generar token para login automático
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role.name as UserRole,
      permissions: user.role.permissions,
    };
    const token = this.jwtService.sign(payload);

    return {
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: user.role.name,
        permissions: user.role.permissions,
      },
    }

  }

  async checkStatus(user: JwtPayload) {
    const payload: JwtPayload = {
      sub: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    };

    const token = this.jwtService.sign(payload);
    return {
      user: user,
      token
    }
  }

  private async getJwtToken(payload: JwtPayload) {
    const token = await this.jwtService.signAsync(payload);
    return token;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isOldPasswordValid = await bcryptjs.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    user.password = await bcryptjs.hash(newPassword, 10);
    await this.usersRepository.save(user);

    return { message: 'Contraseña actualizada exitosamente' };
  }


}
