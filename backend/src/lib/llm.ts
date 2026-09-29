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
