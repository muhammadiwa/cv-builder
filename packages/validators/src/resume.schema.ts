import { z } from 'zod';

export const createResumeSchema = z.object({
  title: z.string().min(1).max(200),
  language: z.enum(['id', 'en']).default('id'),
});

export const updateResumeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  sections: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        sectionType: z.enum([
          'header', 'summary', 'experience', 'education',
          'skills', 'certifications', 'projects', 'languages', 'achievements',
        ]),
        displayOrder: z.number().int().min(0),
        content: z.record(z.unknown()).default({}),
        visible: z.boolean().optional(),
      }),
    )
    .optional(),
});

export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
