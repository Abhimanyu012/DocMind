import { query } from '../../db/pool';
import { HttpError } from '../../lib/httpError';
import { getEmbedding } from '../../lib/embeddings';
import { generateChatCompletion, ChatMessage } from '../../lib/llm';
import { AskChatInput } from './chat.schemas';

export interface ChatSource {
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

export class ChatService {
  // WHY: Core RAG Pipeline:
  // 1. Verify ownership
  // 2. Embed user question
  // 3. Perform vector similarity search in pgvector using cosine distance (<=>)
  // 4. Ground LLM with retrieved context
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

    // 1. Embed user query using Gemini
    const queryEmbedding = await getEmbedding(question);
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // 2. Query nearest vector chunks using pgvector cosine distance operator (<=>)
    // ORDER BY distance ASC returns the closest semantic matches
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

    // 3. Format retrieved context
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

    // 4. Generate grounded answer via Groq LLM
    const answer = await generateChatCompletion(promptMessages);

    // Format sources with calculated cosine similarity score (1 - distance)
    const sources: ChatSource[] = relevantChunks.map((c) => ({
      chunkIndex: c.chunk_index,
      content: c.content,
      similarity: Number((1 - c.distance).toFixed(4)),
    }));

    return {
      answer,
      sources,
    };
  }
}

export const chatService = new ChatService();
