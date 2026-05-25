import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
      callbackURL: config.get<string>('LINKEDIN_CALLBACK_URL', '/api/v1/auth/linkedin/callback'),
      scope: ['openid', 'profile', 'email'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: any) {
    return done(null, profile);
  }
}
