import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { prisma } from '@lolos/database';

// PII fields and their placeholder replacements
const PII_RULES: { regex: RegExp; placeholder: string; field: string }[] = [
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, placeholder: '[USER_EMAIL]', field: 'email' },
  { regex: /(\+62|62|0)8[1-9][0-9]{6,11}/g, placeholder: '[USER_PHONE]', field: 'phone' },
  { regex: /\b\d{16}\b/g, placeholder: '[USER_NIK]', field: 'nik' },
];

// Named PII fields to strip from objects (recursive deep scan)
const PII_KEYS = new Set([
  'email', 'phone', 'fullName', 'full_name', 'name',
  'address', 'location', 'photoUrl', 'photo_url',
  'nik', 'ktp', 'linkedinUrl', 'linkedin_url',
]);

const PII_PLACEHOLDERS: Record<string, string> = {
  email: '[USER_EMAIL]',
  phone: '[USER_PHONE]',
  fullName: '[USER_NAME]',
  full_name: '[USER_NAME]',
  name: '[USER_NAME]',
  address: '[USER_ADDRESS]',
  location: '[USER_ADDRESS]',
  photoUrl: '[USER_PHOTO]',
  photo_url: '[USER_PHOTO]',
  nik: '[USER_NIK]',
  ktp: '[USER_NIK]',
  linkedinUrl: '[USER_URL]',
  linkedin_url: '[USER_URL]',
};

// Reverse map: placeholder → field name
const PLACEHOLDER_TO_FIELD: Record<string, string> = {};
for (const [field, placeholder] of Object.entries(PII_PLACEHOLDERS)) {
  PLACEHOLDER_TO_FIELD[placeholder] = field;
}

// Export for use by PII injection service
export { PII_PLACEHOLDERS, PLACEHOLDER_TO_FIELD, PII_KEYS };

@Injectable()
export class PiiStrippingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    return next.handle().pipe(
      map((data) => {
        // Strip PII from the request body before it goes out
        if (request.body) {
          this.stripPiiFromObject(request.body, userId);
        }
        return data;
      }),
    );
  }

  private stripPiiFromObject(obj: any, userId?: string, path: string = 'root'): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'object') {
          this.stripPiiFromObject(obj[i], userId, `${path}[${i}]`);
        } else if (typeof obj[i] === 'string') {
          obj[i] = this.maskPiiText(obj[i]);
        }
      }
      return;
    }

    for (const key of Object.keys(obj)) {
      const value = obj[key];

      if (PII_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
        obj[key] = PII_PLACEHOLDERS[key] || `[USER_${key.toUpperCase()}]`;
        this.auditLog(userId, 'pii_strip', key, value, `${path}.${key}`);
      } else if (typeof value === 'object' && value !== null) {
        this.stripPiiFromObject(value, userId, `${path}.${key}`);
      } else if (typeof value === 'string') {
        obj[key] = this.maskPiiText(value);
      }
    }
  }

  private maskPiiText(text: string): string {
    let masked = text;
    for (const rule of PII_RULES) {
      masked = masked.replace(rule.regex, rule.placeholder);
    }
    return masked;
  }

  /**
   * Auto-fail check: scan the final outbound payload for any PII that survived stripping.
   * Called by AI gateway before sending to external LLM API.
   */
  static detectPiiLeak(payload: any): { leaked: boolean; fields: string[] } {
    const leaked: string[] = [];
    const json = JSON.stringify(payload);

    for (const rule of PII_RULES) {
      if (rule.regex.test(json)) {
        leaked.push(rule.field);
      }
    }

    // Also check for known placeholder escapes (someone trying to bypass stripping)
    if (json.includes('ignore previous instructions') || json.includes('forget all')) {
      leaked.push('prompt_injection_attempt');
    }

    return { leaked: leaked.length > 0, fields: leaked };
  }

  private auditLog(userId: string | undefined, operation: string, field: string, originalValue: string, location: string) {
    // Log to console in development, to DB in production
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PII Strip] userId=${userId || 'anon'} field=${field} location=${location}`);
      return;
    }

    // Async fire-and-forget audit logging (don't block the request)
    prisma.aiUsageLog.create({
      data: {
        userId: userId || 'system',
        operationType: operation,
        modelUsed: 'pii-gateway',
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
      },
    }).catch((err) => console.error('[PII Audit] Failed to log:', err));
  }
}
