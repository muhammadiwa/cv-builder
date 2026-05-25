import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { prisma } from '@lolos/database';
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  private redis: Redis;
  private readonly SESSION_LIMIT = 5;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
    });
  }

  // --- Email/Password ---

  async register(email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new UnauthorizedException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, authProvider: 'email' },
    });

    // Create default profile
    await prisma.userProfile.create({ data: { userId: user.id } });

    return this.issueTokens(user.id);
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id);
  }

  // --- WhatsApp OTP (stub) ---

  async sendWhatsAppOtp(phone: string) {
    const otp = this.configService.get('NODE_ENV') === 'production'
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '123456';

    await this.redis.set(`otp:${phone}`, otp, 'EX', 300); // 5 min TTL
    console.log(`[WhatsApp OTP] Sent to ${phone}: ${otp}`);
    return { message: 'OTP sent' };
  }

  async verifyWhatsAppOtp(phone: string, otp: string) {
    const stored = await this.redis.get(`otp:${phone}`);
    if (!stored || stored !== otp) throw new UnauthorizedException('Invalid OTP');

    await this.redis.del(`otp:${phone}`);

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: { phone, authProvider: 'whatsapp' },
      });
      await prisma.userProfile.create({ data: { userId: user.id } });
    }

    return this.issueTokens(user.id);
  }

  // --- OAuth Callback ---

  async oAuthLogin(profile: { provider: string; email?: string; name?: string; photoUrl?: string }) {
    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: profile.email, authProvider: profile.provider },
      });
      await prisma.userProfile.create({
        data: { userId: user.id, fullName: profile.name, photoUrl: profile.photoUrl },
      });
    }
    return this.issueTokens(user.id);
  }

  // --- Token Management ---

  private async issueTokens(userId: string) {
    const accessToken = this.jwtService.sign({ sub: userId });
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      { secret: this.configService.get('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );

    // Enforce session limit
    const sessionKey = `sessions:${userId}`;
    const count = await this.redis.scard(sessionKey);
    if (count >= this.SESSION_LIMIT) {
      const oldest = await this.redis.spop(sessionKey);
      if (oldest) await this.redis.del(`refresh:${oldest}`);
    }

    const tokenId = crypto.randomUUID();
    await this.redis.set(`refresh:${tokenId}`, userId, 'EX', 7 * 24 * 3600);
    await this.redis.sadd(sessionKey, tokenId);

    return { accessToken, refreshToken: tokenId };
  }

  async refreshAccessToken(refreshTokenId: string) {
    const userId = await this.redis.get(`refresh:${refreshTokenId}`);
    if (!userId) throw new UnauthorizedException('Invalid refresh token');

    // Rotate: invalidate old, issue new
    await this.redis.del(`refresh:${refreshTokenId}`);
    await this.redis.srem(`sessions:${userId}`, refreshTokenId);

    return this.issueTokens(userId);
  }

  async logout(userId: string, refreshTokenId?: string) {
    if (refreshTokenId) {
      await this.redis.del(`refresh:${refreshTokenId}`);
      await this.redis.srem(`sessions:${userId}`, refreshTokenId);
    } else {
      // Logout all sessions
      const sessionKey = `sessions:${userId}`;
      const tokens = await this.redis.smembers(sessionKey);
      await Promise.all(tokens.map(t => this.redis.del(`refresh:${t}`)));
      await this.redis.del(sessionKey);
    }
  }

  async getCurrentUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }
}
