// WHY: RAG requires splitting long documents into manageable chunks so they fit in LLM context windows
// and represent focused semantic ideas for vector search.

export interface ChunkOptions {
  chunkSize?: number; // Target chunk character size (e.g. 500)
  overlap?: number;   // Character overlap between adjacent chunks (e.g. 100)
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize || 500;
  const overlap = options.overlap || 100;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleanedText = text.replace(/\r\n/g, '\n').trim();
  const chunks: string[] = [];

  let startIndex = 0;
  const totalLength = cleanedText.length;

  while (startIndex < totalLength) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= totalLength) {
      chunks.push(cleanedText.substring(startIndex).trim());
      break;
    }

    // Try to split on clean boundaries (sentence endings, newlines, or spaces)
    let splitPoint = -1;
    const window = cleanedText.substring(startIndex, endIndex);

    // Look for paragraph break
    const lastNewline = window.lastIndexOf('\n');
    if (lastNewline > chunkSize * 0.6) {
      splitPoint = startIndex + lastNewline;
    } else {
      // Look for sentence break (period, question mark, exclamation mark followed by space)
      const lastSentence = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! ')
      );
      if (lastSentence > chunkSize * 0.5) {
        splitPoint = startIndex + lastSentence + 1;
      } else {
        // Look for word space
        const lastSpace = window.lastIndexOf(' ');
        if (lastSpace > chunkSize * 0.4) {
          splitPoint = startIndex + lastSpace;
        } else {
          splitPoint = endIndex;
        }
      }
    }

    const chunkContent = cleanedText.substring(startIndex, splitPoint).trim();
    if (chunkContent.length > 0) {
      chunks.push(chunkContent);
    }

    // Advance startIndex by chunk length minus overlap
    startIndex = Math.max(splitPoint - overlap, startIndex + 1);
  }

  return chunks;
}
