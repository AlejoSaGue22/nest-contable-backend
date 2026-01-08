import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { RegisteAuthDto } from './dto/register-dto';
import { LoginAuthDto } from './dto/login-dto';
import { UsersService } from 'src/users/users.service';
import * as bcryptjs from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService
  ){}

  async login(createAuthDto: LoginAuthDto) {

      const { email, password } = createAuthDto;
      const user = await this.userService.findOneEmailWithPassword(email);

      if(!user) throw new BadRequestException('Usuario no existe en el sistema');

      const isPasswordValid = await bcryptjs.compare(password, user.password);
      const id = user.id;
      console.log("ID Auth Service: ", id);
      if(!isPasswordValid) throw new BadRequestException('Contraseña incorrecta');
      const token = this.jwtService.sign({ email, id });

      return {
          user: {
            email: user.email,
            name: user.fullName,
            role: user.role,
          },
          token
      };
  }

  async register(createAuthDto: RegisteAuthDto) {

    const { email, password, fullname } = createAuthDto;
    const userFind = await this.userService.findOneEmail(email);

    if(userFind) throw new BadRequestException('Usuario ya se encuentra registrado');

    const user = await this.userService.create({
      email,
      fullName: fullname,
      password: await bcryptjs.hash(password, 10)
    })

    return {
        user: user,
        token: this.jwtService.sign({ email })
    }


  }

  async checkStatus( user: User){
      return {
        user: user,
        token: this.getJwtToken({ email: user.email, id: user.id })
      }
  }

  private getJwtToken( payload: JwtPayload ) {
      const token = this.jwtService.sign( payload );   
      return token;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  private handleDBErrors( error: any ): never {

    if ( error.code === '23505' ) 
      throw new BadRequestException( error.detail );

    console.log(error)
    throw new InternalServerErrorException('Please check server logs');

  }


}
