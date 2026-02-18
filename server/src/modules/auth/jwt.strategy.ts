import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Ensure it's extracting from Bearer token
      ignoreExpiration: false, // Token should not be expired
      // Keep this aligned with AuthModule JwtModule.registerAsync secret.
      secretOrKey: configService.get<string>('admin.jwt_secret'),
    });
  }

  async validate(payload: any) {
    // This method is called once the JWT is verified
    return { userId: payload.sub, username: payload.username };
  }
}
