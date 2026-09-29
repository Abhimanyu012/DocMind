import crypto from 'crypto';
import { redis } from '../db/redis';

// WHY: Caching duplicate RAG queries saves expensive LLM tokens and responds in milliseconds.

export interface CachedChatResult {
  answer: string;
  sources: any[];
}

function getCacheKey(documentId: string, question: string): string {
  const normalizedQuestion = question.trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(normalizedQuestion).digest('hex').substring(0, 16);
  return `rag:cache:${documentId}:${hash}`;
}

export async function getCachedRAGAnswer(
  documentId: string,
  question: string
): Promise<CachedChatResult | null> {
  try {
    const key = getCacheKey(documentId, question);
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as CachedChatResult;
  } catch (err) {
    console.warn('Cache read error:', err);
    return null;
  }
}

export async function setCachedRAGAnswer(
  documentId: string,
  question: string,
  result: CachedChatResult,
  ttlSeconds = 3600
): Promise<void> {
  try {
    const key = getCacheKey(documentId, question);
    await redis.set(key, JSON.stringify(result), ttlSeconds);
  } catch (err) {
    console.warn('Cache write error:', err);
  }
}
