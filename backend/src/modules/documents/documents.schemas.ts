import { z } from 'zod';

export const documentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid document UUID format'),
  }),
});
