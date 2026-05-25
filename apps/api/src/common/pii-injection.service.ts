import { Injectable } from '@nestjs/common';
import { prisma } from '@lolos/database';
import { PII_PLACEHOLDERS } from './pii-gateway.service';

@Injectable()
export class PiiInjectionService {
  /**
   * Replace placeholders in AI-generated content with the user's actual PII.
   * ONLY called by PDF/DOCX rendering service — never before LLM API calls.
   */
  async injectPii(userId: string, content: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) return content;

    const values: Record<string, string> = {
      '[USER_NAME]': user.profile?.fullName || '',
      '[USER_EMAIL]': user.email || '',
      '[USER_PHONE]': user.phone || '',
      '[USER_ADDRESS]': user.profile?.location || '',
      '[USER_PHOTO]': user.profile?.photoUrl || '',
      '[USER_NIK]': '',
      '[USER_URL]': user.profile?.linkedinUrl || '',
    };

    let result = content;
    for (const [placeholder, value] of Object.entries(values)) {
      if (value) {
        result = result.replaceAll(placeholder, value);
      }
    }

    // Audit log
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PII Inject] userId=${userId}`);
    }

    return result;
  }

  /**
   * Returns a map of placeholder → actual PII value for the user.
   * Use when injecting PII into structured data (JSON).
   */
  async getPiiMap(userId: string): Promise<Record<string, string>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) return {};

    return {
      '[USER_NAME]': user.profile?.fullName || '',
      '[USER_EMAIL]': user.email || '',
      '[USER_PHONE]': user.phone || '',
      '[USER_ADDRESS]': user.profile?.location || '',
      '[USER_PHOTO]': user.profile?.photoUrl || '',
      '[USER_URL]': user.profile?.linkedinUrl || '',
    };
  }
}
