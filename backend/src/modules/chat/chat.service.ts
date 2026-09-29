import { query } from '../../db/pool';
import { HttpError } from '../../lib/httpError';
import { getEmbedding } from '../../lib/embeddings';
import { generateChatCompletion, streamChatCompletion, ChatMessage } from '../../lib/llm';
import { getCachedRAGAnswer, setCachedRAGAnswer } from '../../lib/cache';
import { AskChatInput } from './chat.schemas';

export interface ChatSource {
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  cached?: boolean;
}

export class ChatService {
  // WHY: Core RAG Pipeline with Redis Caching:
  // 1. Check Redis cache first.
  // 2. If miss, embed query, perform pgvector search, ground prompt, call LLM, and cache result.
  async ask(userId: string, input: AskChatInput): Promise<ChatResponse> {
    const { documentId, question } = input;

    // Rule 3: Enforce ownership check before reading document content
    const docResult = await query<{ id: string; title: string }>(
      'SELECT id, title FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );

    const document = docResult.rows[0];
    if (!document) {
      throw new HttpError(404, 'Document not found or access denied', 'DOCUMENT_NOT_FOUND');
    }

    // Step A: Check Redis answer cache
    const cachedResult = await getCachedRAGAnswer(documentId, question);
    if (cachedResult) {
      return {
        answer: cachedResult.answer,
        sources: cachedResult.sources,
        cached: true,
      };
    }

    // Step B: Embed query with Gemini
    const queryEmbedding = await getEmbedding(question);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // Step C: Cosine distance search in pgvector
    const chunkResults = await query<{
      id: string;
      chunk_index: number;
      content: string;
      distance: number;
    }>(
      `SELECT id, chunk_index, content, (embedding <=> $1::vector) AS distance
       FROM chunks
       WHERE document_id = $2
       ORDER BY embedding <=> $1::vector ASC
       LIMIT 4`,
      [vectorString, documentId]
    );

    const relevantChunks = chunkResults.rows;

    if (relevantChunks.length === 0) {
      return {
        answer: 'No relevant information could be found in this document.',
        sources: [],
      };
    }

    // Step D: Format prompt
    const contextBlock = relevantChunks
      .map((c) => `[Section ${c.chunk_index + 1}]:\n${c.content}`)
      .join('\n\n');

    const promptMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `You are DocMind, an intelligent and precise RAG assistant. ` +
          `Answer the user's question accurately using ONLY the provided document context below from "${document.title}". ` +
          `If the answer cannot be determined from the context, honestly state that the document does not contain that information.\n\n` +
          `=== DOCUMENT CONTEXT ===\n${contextBlock}\n=== END CONTEXT ===`,
      },
      {
        role: 'user',
        content: question,
      },
    ];

    // Step E: Call LLM
    const answer = await generateChatCompletion(promptMessages);

    const sources: ChatSource[] = relevantChunks.map((c) => ({
      chunkIndex: c.chunk_index,
      content: c.content,
      similarity: Number((1 - c.distance).toFixed(4)),
    }));

    // Step F: Save in Redis cache for 1 hour (3600 seconds)
    await setCachedRAGAnswer(documentId, question, { answer, sources }, 3600);

    return {
      answer,
      sources,
      cached: false,
    };
  }

  // WHY: Real-time token streaming using Server-Sent Events (SSE).
  async askStream(
    userId: string,
    input: AskChatInput,
    onSources: (sources: ChatSource[]) => void,
    onToken: (token: string) => void
  ): Promise<void> {
    const { documentId, question } = input;

    // Verify ownership
    const docResult = await query<{ id: string; title: string }>(
      'SELECT id, title FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, userId]
    );

    const document = docResult.rows[0];
    if (!document) {
      throw new HttpError(404, 'Document not found or access denied', 'DOCUMENT_NOT_FOUND');
    }

    // Check Redis answer cache
    const cached = await getCachedRAGAnswer(documentId, question);
    if (cached) {
      onSources(cached.sources);
      onToken(cached.answer);
      return;
    }

    // Retrieve chunks with pgvector
    const queryEmbedding = await getEmbedding(question);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    const chunkResults = await query<{
      id: string;
      chunk_index: number;
      content: string;
      distance: number;
    }>(
      `SELECT id, chunk_index, content, (embedding <=> $1::vector) AS distance
       FROM chunks
       WHERE document_id = $2
       ORDER BY embedding <=> $1::vector ASC
       LIMIT 4`,
      [vectorString, documentId]
    );

    const relevantChunks = chunkResults.rows;
    const sources: ChatSource[] = relevantChunks.map((c) => ({
      chunkIndex: c.chunk_index,
      content: c.content,
      similarity: Number((1 - c.distance).toFixed(4)),
    }));

    onSources(sources);

    if (relevantChunks.length === 0) {
      onToken('No relevant information could be found in this document.');
      return;
    }

    const contextBlock = relevantChunks
      .map((c) => `[Section ${c.chunk_index + 1}]:\n${c.content}`)
      .join('\n\n');

    const promptMessages: ChatMessage[] = [
      {
        role: 'system',
        content:
          `You are DocMind, an intelligent and precise RAG assistant. ` +
          `Answer the user's question accurately using ONLY the provided document context below from "${document.title}". ` +
          `If the answer cannot be determined from the context, honestly state that the document does not contain that information.\n\n` +
          `=== DOCUMENT CONTEXT ===\n${contextBlock}\n=== END CONTEXT ===`,
      },
      {
        role: 'user',
        content: question,
      },
    ];

    // Stream tokens from Groq
    const fullAnswer = await streamChatCompletion(promptMessages, onToken);

    // Cache the full answer in Redis
    if (fullAnswer) {
      await setCachedRAGAnswer(documentId, question, { answer: fullAnswer, sources }, 3600);
    }
  }
}

export const chatService = new ChatService();
