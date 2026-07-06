import { z } from 'zod';

// plan.md pinned gemini-2.0-flash, but that model returns 429 (no free-tier quota)
// on the current key; gemini-flash-latest works. See DECISIONS.md 005.
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Call Gemini in structured-JSON mode and validate the result with zod.
 * `responseSchema` is Gemini's OpenAPI-subset schema (native structured output);
 * `schema` is the zod schema we actually trust. On a parse/validation failure we
 * retry ONCE with the same prompt (models occasionally emit malformed JSON), then
 * throw. HTTP/transport failures throw immediately (no retry).
 */
export async function callGemini<T>(
  prompt: string,
  responseSchema: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiError('GEMINI_API_KEY is not set');
  }

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      // flash-latest is a thinking model; we don't need reasoning tokens for a
      // structured breakdown, so disable them to save quota + latency.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AiError(`Gemini API error ${response.status}: ${detail}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      lastError = new AiError('Gemini returned an empty response');
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(text);
      return schema.parse(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  throw new AiError(
    `Gemini response could not be parsed/validated after retry: ${String(lastError)}`,
  );
}
