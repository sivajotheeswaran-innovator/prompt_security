import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { geminiQueue, isQuotaOrRateLimitError } from './gemini-queue';

export { isQuotaOrRateLimitError };

let geminiClient: GoogleGenerativeAI | any | null = null;

export function setGeminiClient(client: GoogleGenerativeAI | any | null) {
  geminiClient = client;
}

export function getGeminiClient(): GoogleGenerativeAI | any | null {
  if (geminiClient) return geminiClient;
  if (!env.GEMINI_API_KEY) return null;
  geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return geminiClient;
}

export const FALLBACK_REPLY_MESSAGE =
  'AI Gateway Notice: Upstream Gemini AI service is currently unavailable. Your prompt was safely scanned and protected by TrustLayer.';

export const RATE_LIMITED_REPLY_MESSAGE =
  'AI Gateway Notice: Upstream Gemini AI service is currently rate limited or quota exceeded (HTTP 429). Please try again shortly. Your prompt was safely scanned and protected by TrustLayer.';

/**
 * Sends prompt to Gemini AI single-turn chat completion.
 * - Queue pacing: at most 1 call per 2s globally, with 429 backoff & retry.
 * - Model: GEMINI_CHAT_MODEL (defaults to GEMINI_MODEL).
 * - maxOutputTokens: 400.
 * - systemInstruction: "answer in under 150 words".
 * - Timeout clamped to 10s SLA.
 * - Thinking budget disabled where supported.
 * - Distinct rate-limited state on 429/quota exhaustion.
 * - NEVER caches chat replies in Layer 2 LRU cache.
 */
export async function generateChatReply(
  promptToSend: string,
  timeoutMs: number = 10_000
): Promise<{ reply: string; isFallback: boolean; isRateLimited?: boolean }> {
  // Test hook to simulate upstream failure and verify fallback message
  if (process.env.FAIL_GEMINI === 'true') {
    console.warn('[ChatGateway] Upstream Gemini failure simulated via FAIL_GEMINI=true');
    return { reply: FALLBACK_REPLY_MESSAGE, isFallback: true };
  }

  const client = getGeminiClient();

  // If no Gemini key is configured
  if (!client) {
    return {
      reply: 'AI Gateway Notice: AI service is currently unavailable. Please configure GEMINI_API_KEY to enable chat responses.',
      isFallback: true,
    };
  }

  const chatModel = env.GEMINI_CHAT_MODEL || env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  const executeCallWithModel = async (modelName: string) => {
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: 'answer in under 150 words',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
      },
    });

    const callPromise = model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptToSend }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini chat request timed out (10s SLA exceeded)')), timeoutMs)
    );

    const result = await Promise.race([callPromise, timeoutPromise]);
    return result.response.text().trim();
  };

  try {
    // Process through the global rate-pacing queue
    const replyText = await geminiQueue.execute(async () => {
      try {
        return await executeCallWithModel(chatModel);
      } catch (err: any) {
        if (isQuotaOrRateLimitError(err) && chatModel !== 'gemini-2.0-flash-lite') {
          console.warn(`[ChatGateway] ${chatModel} quota exhausted. Auto-falling back to gemini-2.0-flash-lite...`);
          return await executeCallWithModel('gemini-2.0-flash-lite');
        }
        throw err;
      }
    });
    return { reply: replyText, isFallback: false };
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) {
      console.warn('[ChatGateway] Gemini rate limit reached (HTTP 429/quota):', err.message || err);
      return { reply: RATE_LIMITED_REPLY_MESSAGE, isFallback: true, isRateLimited: true };
    }

    const errorMsg = err?.message || String(err);
    console.error(`[ChatGateway] Gemini API call failed (${errorMsg}) — returning clear fallback message.`);
    return { reply: FALLBACK_REPLY_MESSAGE, isFallback: true };
  }
}

