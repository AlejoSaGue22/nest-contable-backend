import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { jwtConstants } from 'src/auth/constants/jwt.constants';

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(private readonly jwtService: JwtService){}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractFromHeader(request);

    console.log("Token Guard: ",token)
    if (!token) {
        throw new UnauthorizedException("Token Invalido");
    }


    try {
      const payload = await this.jwtService.verifyAsync(token, {
          secret: jwtConstants.secret
      })

      request.user = payload;
      console.log("User payload: ",request.user);

    } catch(error) {
        console.log(error);
        throw new UnauthorizedException("Error autenticacion")

    }
    return true;
  }

  private extractFromHeader(request: Request): string | undefined {
     const [type, token] = request.headers.authorization?.split(' ') ?? [];
     return type == 'Bearer' ? token : undefined;
  }
}
