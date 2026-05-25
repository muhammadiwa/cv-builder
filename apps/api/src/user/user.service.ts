import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { prisma } from '@lolos/database';
import Redis from 'ioredis';

@Injectable()
export class UserService {
  constructor(@Inject('REDIS') private redis: Redis) {}

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
    await prisma.$transaction(async (tx) => {
      if (data.fullName !== undefined || data.photoUrl !== undefined) {
        await tx.userProfile.update({
          where: { userId },
          data: {
            ...(data.fullName !== undefined && { fullName: data.fullName }),
            ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
          },
        });
      }
      if (data.phone !== undefined || data.languagePreference !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.languagePreference !== undefined && { languagePreference: data.languagePreference }),
          },
        });
      }
    });
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
    // Invalidate all sessions
    const sessionKey = `sessions:${userId}`;
    const tokens = await this.redis.zrange(sessionKey, 0, -1);
    if (tokens.length > 0) {
      await Promise.all(tokens.map((t) => this.redis.del(`refresh:${t}`)));
    }
    await this.redis.del(sessionKey);

    // Anonymize PII in user + profile (transactional)
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { email: `deleted-${userId}@lolos.app`, phone: null },
      });
      await tx.userProfile.update({
        where: { userId },
        data: {
          fullName: '[deleted]',
          photoUrl: null,
          linkedinUrl: null,
          website: null,
          bio: null,
        },
      });
    });

    return { message: 'Account deleted. Data purged in 30 days.' };
  }
}
