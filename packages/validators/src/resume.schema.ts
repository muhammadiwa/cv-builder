import { z } from 'zod';

export const SECTION_TYPES = [
  'header',
  'summary',
  'experience',
  'education',
  'skills',
  'certifications',
  'projects',
  'languages',
  'achievements',
] as const;

export const sectionTypeSchema = z.enum(SECTION_TYPES);

// Per-section content size cap to prevent unbounded JSON growth (~64 KB JSON keeps
// us well under Postgres TOAST and any reasonable resume payload).
const MAX_CONTENT_SERIALIZED_BYTES = 64 * 1024;

const sectionContentSchema = z
  .record(z.unknown())
  .default({})
  .refine(
    (v) => {
      try {
        return JSON.stringify(v).length <= MAX_CONTENT_SERIALIZED_BYTES;
      } catch {
        return false;
      }
    },
    { message: `content payload must serialize to <= ${MAX_CONTENT_SERIALIZED_BYTES} bytes` },
  );

export const sectionInputSchema = z.object({
  // Optional UUID. New sections must omit `id` (server assigns one). The
  // legacy `new-<timestamp>` sentinel is rejected to keep the contract clean.
  id: z.string().uuid().optional(),
  sectionType: sectionTypeSchema,
  displayOrder: z.number().int().min(0).max(999),
  content: sectionContentSchema,
  visible: z.boolean().optional(),
});

export const createResumeSchema = z.object({
  title: z.string().min(1).max(200),
  language: z.enum(['id', 'en']).default('id'),
});

// Hard cap on number of sections per resume. 9 section types * a few entries each
// keeps a realistic ceiling well above normal usage.
const MAX_SECTIONS_PER_RESUME = 64;

export const updateResumeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  sections: z.array(sectionInputSchema).max(MAX_SECTIONS_PER_RESUME).optional(),
});

export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
export type SectionInput = z.infer<typeof sectionInputSchema>;
export type SectionTypeValue = z.infer<typeof sectionTypeSchema>;
