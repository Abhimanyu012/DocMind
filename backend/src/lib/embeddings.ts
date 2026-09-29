import { env } from '../config/env';

// OFFICIAL DOCUMENTATION REFERENCE:
// URL: https://ai.google.dev/api/embeddings#v1beta.models.embedContent
// Model: gemini-embedding-001 (verified via ListModels API)
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=API_KEY
// Embedding Dimension: 768 (configured via outputDimensionality)

export const EMBEDDING_DIMENSION = 768;

/**
 * Generates vector embeddings for a given text snippet using Google Gemini gemini-embedding-001.
 * Configured with outputDimensionality: 768 to match PostgreSQL vector(768).
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return generateMockEmbedding(text);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: {
        parts: [{ text }],
      },
      outputDimensionality: EMBEDDING_DIMENSION,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error:', errorText);
    throw new Error(`Gemini Embeddings API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    embedding?: {
      values: number[];
    };
  };

  if (!data.embedding || !Array.isArray(data.embedding.values)) {
    throw new Error('Invalid response structure received from Gemini Embeddings API');
  }

  return data.embedding.values;
}

/**
 * Generates a normalized 768-dimensional float vector deterministically based on text content.
 */
function generateMockEmbedding(text: string): number[] {
  const vector: number[] = new Array(EMBEDDING_DIMENSION).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const val = Math.sin(hash + i) * Math.cos(i);
    vector[i] = val;
  }

  // Normalize vector to unit length
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map((val) => (norm > 0 ? val / norm : 0));
}
