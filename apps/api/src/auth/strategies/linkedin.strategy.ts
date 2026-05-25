import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(config: ConfigService) {
    const baseUrl = config.get<string>('API_BASE_URL', 'http://localhost:4000');
    super({
      clientID: config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
      callbackURL: `${baseUrl}/api/v1/auth/linkedin/callback`,
      scope: ['openid', 'profile', 'email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: any) {
    return done(null, profile);
  }
}
