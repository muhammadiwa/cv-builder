import { Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { prisma } from '@lolos/database';
import Redis from 'ioredis';

@Injectable()
export class AuthService implements OnModuleDestroy {
  private redis: Redis;
  private readonly SESSION_LIMIT = 5;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: Number(configService.get('REDIS_PORT', 6379)),
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  // --- Email/Password ---

  async register(email: string, password: string) {
    if (!email || !password || password.length < 8) {
      throw new UnauthorizedException('Email and password (min 8 chars) required');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new UnauthorizedException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, authProvider: 'email' },
    });

    await prisma.userProfile.create({ data: { userId: user.id } });

    return this.issueTokens(user.id);
  }

  async login(email: string, password: string) {
    if (!email || !password) throw new UnauthorizedException('Email and password required');

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
    // Production: send via WhatsApp Business API (Twilio/WATI)
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
    if (!profile.email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

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
    const accessToken = this.jwtService.sign(
      { sub: userId },
      { expiresIn: '15m' },
    );

    // Enforce session limit using ZSET (ordered by creation time)
    const sessionKey = `sessions:${userId}`;
    const count = await this.redis.zcard(sessionKey);
    if (count >= this.SESSION_LIMIT) {
      // Remove oldest session (lowest score = earliest timestamp)
      const oldest = await this.redis.zpopmin(sessionKey);
      if (oldest?.[0]) await this.redis.del(`refresh:${oldest[0]}`);
    }

    const tokenId = randomUUID();
    const now = Date.now();
    await this.redis.set(`refresh:${tokenId}`, userId, 'EX', 7 * 24 * 3600);
    await this.redis.zadd(sessionKey, now, tokenId);

    return { accessToken, refreshToken: tokenId };
  }

  async refreshAccessToken(refreshTokenId: string) {
    const userId = await this.redis.get(`refresh:${refreshTokenId}`);
    if (!userId) throw new UnauthorizedException('Invalid refresh token');

    // Issue new tokens FIRST, then rotate
    const newTokens = await this.issueTokens(userId);

    await this.redis.del(`refresh:${refreshTokenId}`);
    await this.redis.zrem(`sessions:${userId}`, refreshTokenId);

    return newTokens;
  }

  async logout(userId: string, refreshTokenId?: string) {
    if (refreshTokenId) {
      await this.redis.del(`refresh:${refreshTokenId}`);
      await this.redis.zrem(`sessions:${userId}`, refreshTokenId);
    } else {
      const sessionKey = `sessions:${userId}`;
      const tokens = await this.redis.zrange(sessionKey, 0, -1);
      if (tokens.length > 0) {
        await Promise.all(tokens.map((t) => this.redis.del(`refresh:${t}`)));
      }
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
