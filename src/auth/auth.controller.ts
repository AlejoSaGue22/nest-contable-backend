import { LoginAuthDto } from './dto/login-dto';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisteAuthDto } from './dto/register-dto';
import { AuthGuard } from './guard/auth/auth.guard';
import { RequestWithUser } from './interfaces/jwt-payload.interface';
import { User } from 'src/users/entities/user.entity';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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
  async getProfile(@CurrentUser() user: any) {
    return {
      success: true,
      data: user,
      message: 'Perfil obtenido exitosamente',
    };
  }

  @Post('refresh')
  @UseGuards(AuthGuard)
  async refreshToken(@CurrentUser() user: any) {
    const data = await this.authService.refreshToken(user.sub);
    return {
      success: true,
      data: data,
      message: 'Token refrescado exitosamente',
    };
  }

  @Get('check-status')
  @UseGuards(AuthGuard)
  async check_status(@Req() req: RequestWithUser) {
    const { user, token } = await this.authService.checkStatus(req.user);

    return { user, token };
  }

  @Patch('change-password')
  @UseGuards(AuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.authService.changePassword(
      user.sub,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword
    );
  }

  @Patch('change-password/:id')
  @UseGuards(AuthGuard)
  async changePasswordByAdmin(@Param('id') id: string, @Body() password: string ) {
    return this.authService.changePasswordByAdmin(id, password);
  }

}
