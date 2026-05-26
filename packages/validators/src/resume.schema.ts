import { z } from 'zod';

export const createResumeSchema = z.object({
  title: z.string().min(1).max(200),
  language: z.enum(['id', 'en']).default('id'),
});

export const updateResumeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export type CreateResumeInput = z.infer<typeof createResumeSchema>;
export type UpdateResumeInput = z.infer<typeof updateResumeSchema>;
