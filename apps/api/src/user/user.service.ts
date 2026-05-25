import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@lolos/database';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {
  private redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException();
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, data: { fullName?: string; phone?: string; photoUrl?: string; languagePreference?: string }) {
    if (data.fullName || data.photoUrl) {
      await prisma.userProfile.update({
        where: { userId },
        data: {
          ...(data.fullName !== undefined && { fullName: data.fullName }),
          ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        },
      });
    }
    if (data.phone !== undefined || data.languagePreference !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.languagePreference !== undefined && { languagePreference: data.languagePreference }),
        },
      });
    }
    return this.getProfile(userId);
  }

  async listSessions(userId: string) {
    const members = await this.redis.zrange(`sessions:${userId}`, 0, -1, 'WITHSCORES');
    const sessions = [];
    for (let i = 0; i < members.length; i += 2) {
      sessions.push({
        tokenId: members[i],
        createdAt: new Date(parseInt(members[i + 1])).toISOString(),
      });
    }
    return sessions;
  }

  async revokeSession(userId: string, tokenId: string) {
    await this.redis.del(`refresh:${tokenId}`);
    await this.redis.zrem(`sessions:${userId}`, tokenId);
    return { message: 'Session revoked' };
  }

  async deleteAccount(userId: string) {
    // Soft delete: mark as deleted, anonymize PII
    await prisma.user.update({
      where: { id: userId },
      data: { email: `deleted-${userId}@lolos.app`, phone: null },
    });
    // Hard delete after 30 days via cron job
    return { message: 'Account deletion requested. Data will be purged in 30 days.' };
  }
}
