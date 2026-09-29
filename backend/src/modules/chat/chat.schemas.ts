import { z } from 'zod';

export const askChatSchema = z.object({
  body: z.object({
    documentId: z.string().uuid('Invalid document UUID'),
    question: z.string().min(1, 'Question is required'),
  }),
});

export type AskChatInput = z.infer<typeof askChatSchema>['body'];
