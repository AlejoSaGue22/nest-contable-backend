import { LoginAuthDto } from './dto/login-dto';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisteAuthDto } from './dto/register-dto';
import { AuthGuard } from './guard/auth/auth.guard';
import { RequestWithUser } from './interfaces/jwt-payload.interface';

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

  @Get('check-status')
  @UseGuards(AuthGuard)
  check_status(@Req() req: RequestWithUser) {
    const user = req.user;
    
    return this.authService.checkStatus(user);
  }


}
