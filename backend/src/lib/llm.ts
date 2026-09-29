import https from 'https';
import { env } from '../config/env';

// OFFICIAL DOCUMENTATION REFERENCE:
// URL: https://console.groq.com/docs/openai
// Models Verified via /models API: openai/gpt-oss-120b, openai/gpt-oss-20b
// Endpoint: https://api.groq.com/openai/v1/chat/completions
// Headers: Authorization: Bearer GROQ_API_KEY, Content-Type: application/json

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function generateChatCompletion(messages: ChatMessage[]): Promise<string> {
  const apiKey = env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
    return (
      `[DocMind Demo Mode - Please set GROQ_API_KEY in .env for live Groq generation]\n\n` +
      `Retrieved context analysis:\n${sysMsg.slice(0, 300)}...`
    );
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq API Error:', errorText);
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  };

  if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
    throw new Error('Invalid response structure received from Groq API');
  }

  return data.choices[0].message.content;
}

/**
 * Streams chat completion tokens in real-time using native Node.js https streaming for maximum stability.
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onToken: (token: string) => void
): Promise<string> {
  const apiKey = env.GROQ_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    const simulatedAnswer = 'DocMind Streaming Demo Mode: Verified answer streamed token by token.';
    const words = simulatedAnswer.split(' ');
    for (const word of words) {
      onToken(word + ' ');
      await new Promise((r) => setTimeout(r, 40));
    }
    return simulatedAnswer;
  }

  return new Promise<string>((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages,
      temperature: 0.2,
      stream: true,
    });

    const req = https.request(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errBody = '';
          res.on('data', (c) => (errBody += c));
          res.on('end', () => reject(new Error(`Groq error (${res.statusCode}): ${errBody}`)));
          return;
        }

        let buffer = '';
        let fullAnswer = '';

        res.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed === 'data: [DONE]') {
              resolve(fullAnswer);
              return;
            }

            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  fullAnswer += delta;
                  onToken(delta);
                }
              } catch {
                // ignore unparsed fragments
              }
            }
          }
        });

        res.on('end', () => {
          resolve(fullAnswer);
        });

        res.on('error', (err) => {
          reject(err);
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}
