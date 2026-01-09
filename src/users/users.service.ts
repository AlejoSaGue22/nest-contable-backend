import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { Role } from 'src/roles/entities/role.entity';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ){}

  async create(createUserDto: CreateUserDto) {

    const user = this.usersRepository.create(createUserDto);

    return this.usersRepository.save(user);
  }

  async save(createUserDto: CreateUserDto) {
    return await this.usersRepository.save(createUserDto);
  }

  async findAll() {
    return this.usersRepository.find();
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOneBy({id})
        
    if (!user) {
        throw new BadRequestException('Usuario no encontrado');
    }

    return user;
  }

  async findOneEmail(email: string) {
    const user = await this.usersRepository.findOneBy({ email });

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

  async update(id: string, updateUserDto: UpdateUserDto) {

    const user = await this.usersRepository.findOneBy({id})

    if (!user) {
        throw new BadRequestException('Usuario no encontrado');
    }

    const update = await this.usersRepository.update(id, updateUserDto);

    return update;
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.usersRepository.softDelete(id);
  }
}
