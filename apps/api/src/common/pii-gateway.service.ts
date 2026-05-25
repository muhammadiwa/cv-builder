import { Injectable, InternalServerErrorException } from '@nestjs/common';
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

const PLACEHOLDER_TO_FIELD: Record<string, string> = {};
for (const [field, placeholder] of Object.entries(PII_PLACEHOLDERS)) {
  PLACEHOLDER_TO_FIELD[placeholder] = field;
}

export { PII_PLACEHOLDERS, PLACEHOLDER_TO_FIELD, PII_KEYS };

@Injectable()
export class PiiGatewayService {
  /**
   * Strip PII from any payload object. Called by AI gateway services BEFORE
   * sending data to external LLM APIs. Returns a deep clone with PII replaced.
   * Original object is NOT mutated.
   */
  stripPii(payload: any, userId?: string): any {
    const clone = JSON.parse(JSON.stringify(payload));
    this.stripFromObject(clone, userId);
    return clone;
  }

  /**
   * Verify that a payload is PII-clean before sending to external LLM API.
   * Throws InternalServerErrorException if PII is detected.
   */
  verifyPiiClean(payload: any): void {
    const result = PiiGatewayService.detectPiiLeak(payload);
    if (result.leaked) {
      console.error(
        `[PII GATEWAY] BLOCKED outbound payload: PII leaked in fields: ${result.fields.join(', ')}`,
      );
      throw new InternalServerErrorException(
        'PII detected in outbound payload — request blocked',
      );
    }
  }

  /**
   * Combined: strip + verify. The main entry point for AI gateway services.
   * Returns PII-safe payload ready for LLM API call.
   */
  sanitize(payload: any, userId?: string): any {
    const clean = this.stripPii(payload, userId);
    this.verifyPiiClean(clean);
    return clean;
  }

  // ---- Private helpers ----

  private stripFromObject(obj: any, userId?: string, path: string = 'root'): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'object') {
          this.stripFromObject(obj[i], userId, `${path}[${i}]`);
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
        this.auditLog(userId, key, `${path}.${key}`);
      } else if (typeof value === 'object' && value !== null) {
        this.stripFromObject(value, userId, `${path}.${key}`);
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

  private static detectPiiLeak(payload: any): { leaked: boolean; fields: string[] } {
    const leaked: string[] = [];
    const json = JSON.stringify(payload);

    for (const rule of PII_RULES) {
      if (rule.regex.test(json)) {
        leaked.push(rule.field);
      }
    }

    if (json.includes('ignore previous instructions') || json.includes('forget all')) {
      leaked.push('prompt_injection_attempt');
    }

    return { leaked: leaked.length > 0, fields: leaked };
  }

  private auditLog(userId: string | undefined, field: string, location: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PII Strip] userId=${userId || 'anon'} field=${field} location=${location}`);
      return;
    }

    prisma.aiUsageLog.create({
      data: {
        userId: userId || 'system',
        operationType: 'pii_strip',
        modelUsed: 'pii-gateway',
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
      },
    }).catch((err) => console.error('[PII Audit] Failed to log:', err));
  }
}
