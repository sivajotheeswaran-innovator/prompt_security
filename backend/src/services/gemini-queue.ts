/**
 * Global Request Queue & Rate Pacer for Gemini API calls.
 * Enforces:
 * 1. At most 1 Gemini call per 2s globally.
 * 2. Backoff honoring Retry-After / retryDelay on 429.
 * 3. Max ONE retry on rate limit before returning a distinct rate-limited state.
 */

export class GeminiRateLimitError extends Error {
  public readonly isRateLimited = true;
  public readonly retryAfterMs?: number;

  constructor(message = 'Gemini API rate limited or quota exceeded (HTTP 429)', retryAfterMs?: number) {
    super(message);
    this.name = 'GeminiRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Checks if an error represents a 429 or rate limit / quota exhaustion.
 */
export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  if (err instanceof GeminiRateLimitError || err.isRateLimited) return true;
  const status = err.status || err.statusCode || err.response?.status;
  if (status === 429) return true;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit')
  );
}

/**
 * Extracts retry delay in milliseconds from an error or headers.
 * Looks for Retry-After header, retryDelay in error payload, or error message.
 */
export function parseRetryDelay(err: any): number | null {
  if (!err) return null;

  // 1. Direct property on error
  if (typeof err.retryDelay === 'number') {
    return err.retryDelay > 100 ? err.retryDelay : Math.round(err.retryDelay * 1000);
  }
  if (typeof err.retryDelay === 'string') {
    const m = err.retryDelay.match(/^(\d+(?:\.\d+)?)(s|ms)?$/i);
    if (m) {
      const val = parseFloat(m[1]);
      return m[2]?.toLowerCase() === 'ms' ? val : Math.round(val * 1000);
    }
  }

  // 2. HTTP header retry-after
  const retryHeader =
    err.response?.headers?.get?.('retry-after') ||
    err.response?.headers?.['retry-after'] ||
    err.headers?.['retry-after'];
  if (retryHeader) {
    const seconds = parseFloat(retryHeader);
    if (!isNaN(seconds)) return Math.round(seconds * 1000);
  }

  // 3. String pattern matching in err.message or JSON string
  const msg = typeof err.message === 'string' ? err.message : String(err);
  const jsonMatch = msg.match(/retryDelay["']?:\s*["']?(\d+(?:\.\d+)?)(s|ms)?/i);
  if (jsonMatch) {
    const val = parseFloat(jsonMatch[1]);
    return jsonMatch[2]?.toLowerCase() === 'ms' ? val : Math.round(val * 1000);
  }

  const inMatch = msg.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*(s|sec|seconds|ms)?/i);
  if (inMatch) {
    const val = parseFloat(inMatch[1]);
    return inMatch[2]?.toLowerCase() === 'ms' ? val : Math.round(val * 1000);
  }

  const afterMatch = msg.match(/retry(?:ing)?\s+after\s+(\d+(?:\.\d+)?)\s*(s|sec|seconds|ms)?/i);
  if (afterMatch) {
    const val = parseFloat(afterMatch[1]);
    return afterMatch[2]?.toLowerCase() === 'ms' ? val : Math.round(val * 1000);
  }

  return null;
}

export class GeminiQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastCallTimestamp = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs = 2000) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Enqueue a Gemini API operation.
   * Operations are paced to execute at most 1 call per minIntervalMs (default 2s) globally.
   * On 429, honors retryDelay, retries max once, then throws GeminiRateLimitError.
   */
  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(operation);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      // Global pacing: at most 1 call per 2s
      const now = Date.now();
      const elapsed = now - this.lastCallTimestamp;
      if (this.lastCallTimestamp > 0 && elapsed < this.minIntervalMs) {
        const waitTime = this.minIntervalMs - elapsed;
        await new Promise((r) => setTimeout(r, waitTime));
      }
      this.lastCallTimestamp = Date.now();

      await task();
    }

    this.isProcessing = false;
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err: any) {
      if (!isQuotaOrRateLimitError(err)) {
        throw err;
      }

      const parsedDelay = parseRetryDelay(err);
      console.warn(
        `[GeminiQueue] 429 rate limit encountered. Detected retry delay: ${parsedDelay !== null ? parsedDelay + 'ms' : 'none'}`
      );

      // If retryDelay is excessively large (e.g., daily quota 16 hours),
      // waiting would violate request timeout SLAs, so fail immediately with distinct rate-limited state.
      if (parsedDelay !== null && parsedDelay > 10_000) {
        throw new GeminiRateLimitError(
          `Gemini daily quota exceeded or retry delay too long (${parsedDelay}ms)`,
          parsedDelay
        );
      }

      const backoffMs = parsedDelay !== null ? Math.max(parsedDelay, 100) : 2000;
      await new Promise((r) => setTimeout(r, backoffMs));

      // At most ONE retry
      try {
        this.lastCallTimestamp = Date.now();
        return await operation();
      } catch (retryErr: any) {
        if (isQuotaOrRateLimitError(retryErr)) {
          const secondDelay = parseRetryDelay(retryErr) ?? backoffMs;
          throw new GeminiRateLimitError(
            `Gemini retry failed due to persistent rate limit: ${retryErr.message || retryErr}`,
            secondDelay
          );
        }
        throw retryErr;
      }
    }
  }

  public setMinInterval(ms: number) {
    this.minIntervalMs = ms;
  }

  public getMinInterval(): number {
    return this.minIntervalMs;
  }

  public reset() {
    this.queue = [];
    this.isProcessing = false;
    this.lastCallTimestamp = 0;
  }
}

// Global singleton queue
export const geminiQueue = new GeminiQueue(2000);
