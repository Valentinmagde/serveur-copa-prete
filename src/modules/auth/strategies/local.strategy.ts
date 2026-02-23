import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passReqToCallback: true, // Ajouter ceci pour recevoir la requête
    });
  }

  async validate(req: any, email: string, password: string): Promise<any> {
    // Récupérer l'IP et le user-agent de la requête
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const user = await this.authService.validateUser(
      email,
      password,
      ipAddress,
      userAgent,
    );

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
