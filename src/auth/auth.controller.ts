import { LoginAuthDto } from './dto/login-dto';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisteAuthDto } from './dto/register-dto';
import { AuthGuard } from './guard/auth/auth.guard';
import { RequestWithUser } from './interfaces/jwt-payload.interface';
import { User } from 'src/users/entities/user.entity';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  registerAuth(@Body() createAuthDto: RegisteAuthDto) {
    return this.authService.register(createAuthDto);
  }

  @Post('login')
  loginAuth(@Body() createAuthDto: LoginAuthDto) {
      return this.authService.login(createAuthDto)
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  async getProfile(@CurrentUser() user: User) {
    // const profile = await this.authService.getProfile(user.id);
    return {
      success: true,
      // data: profile,
      message: 'Perfil obtenido exitosamente',
    };
  }

  @Post('refresh')
  @UseGuards(AuthGuard)
  async refreshToken(@CurrentUser() user: User) {
    // const token = await this.authService.refreshToken(user.id);
    return {
      success: true,
      // data: token,
      message: 'Token refrescado exitosamente',
    };
  }

  @Get('check-status')
  @UseGuards(AuthGuard)
  async check_status(@Req() req: RequestWithUser) {
    const {user, token} = await this.authService.checkStatus(req.user);
    
    return {user, token};
  }


}
