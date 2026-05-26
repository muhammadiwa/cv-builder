import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * NestJS pipe that validates incoming request bodies (or any param) against a
 * Zod schema. On failure it surfaces the path + message of every issue so the
 * frontend can display field-level feedback.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'ValidationError',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      });
    }
    return result.data;
  }
}
