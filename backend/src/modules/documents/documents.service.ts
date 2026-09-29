import { query } from '../../db/pool';
import { HttpError } from '../../lib/httpError';
import { chunkText } from '../../lib/chunker';
import { getEmbedding } from '../../lib/embeddings';

export interface DocumentRecord {
  id: string;
  user_id: string;
  title: string;
  filename: string;
  created_at: string;
  chunk_count?: number;
}

export class DocumentsService {
  // WHY: Handles document ingestion pipeline: parsing text -> chunking -> vector embeddings -> storing in pgvector.
  // Rule 3: Enforces user_id filtering to guarantee data isolation between users.
  async uploadDocument(
    userId: string,
    filename: string,
    rawContent: string,
    title?: string
  ): Promise<DocumentRecord> {
    if (!rawContent || rawContent.trim().length === 0) {
      throw new HttpError(400, 'Uploaded file contains no readable text content', 'EMPTY_FILE');
    }

    const docTitle = title || filename;

    // 1. Create document record bound to userId
    const docResult = await query<DocumentRecord>(
      `INSERT INTO documents (user_id, title, filename)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, title, filename, created_at`,
      [userId, docTitle, filename]
    );

    const document = docResult.rows[0];

    // 2. Split document into overlapping text chunks
    const chunks = chunkText(rawContent, { chunkSize: 500, overlap: 100 });

    if (chunks.length === 0) {
      chunks.push(rawContent.trim());
    }

    // 3. Generate embeddings and store each chunk in PostgreSQL with pgvector
    for (let i = 0; i < chunks.length; i++) {
      const chunkTextContent = chunks[i];
      const embedding = await getEmbedding(chunkTextContent);
      const vectorString = `[${embedding.join(',')}]`;

      await query(
        `INSERT INTO chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [document.id, i, chunkTextContent, vectorString]
      );
    }

    document.chunk_count = chunks.length;
    return document;
  }

  // WHY: Lists all documents belonging ONLY to the requesting user.
  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    const result = await query<DocumentRecord>(
      `SELECT d.id, d.title, d.filename, d.created_at,
              COUNT(c.id)::int AS chunk_count
       FROM documents d
       LEFT JOIN chunks c ON d.id = c.document_id
       WHERE d.user_id = $1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  // WHY: Fetches a single document and verifies user ownership.
  async getDocument(userId: string, documentId: string): Promise<DocumentRecord> {
    const result = await query<DocumentRecord>(
      `SELECT d.id, d.title, d.filename, d.created_at,
              COUNT(c.id)::int AS chunk_count
       FROM documents d
       LEFT JOIN chunks c ON d.id = c.document_id
       WHERE d.id = $1 AND d.user_id = $2
       GROUP BY d.id`,
      [documentId, userId]
    );

    const doc = result.rows[0];
    if (!doc) {
      throw new HttpError(404, 'Document not found or access denied', 'DOCUMENT_NOT_FOUND');
    }

    return doc;
  }

  // WHY: Deletes the document; cascade delete automatically clears associated chunks in pgvector.
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    // Check ownership before deletion
    const existing = await query('SELECT id FROM documents WHERE id = $1 AND user_id = $2', [
      documentId,
      userId,
    ]);

    if (existing.rows.length === 0) {
      throw new HttpError(404, 'Document not found or access denied', 'DOCUMENT_NOT_FOUND');
    }

    await query('DELETE FROM documents WHERE id = $1 AND user_id = $2', [documentId, userId]);
  }
}

export const documentsService = new DocumentsService();
