import crypto from 'crypto';

export interface CachedLayer2Data {
  findings: Array<{
    type: string;
    text: string;
    confidence: number;
    explanation: string;
  }>;
}

interface CacheEntry {
  data: CachedLayer2Data;
  expiresAt: number;
}

/**
 * In-memory LRU cache for Layer 2 PII detection.
 * - Max 200 entries
 * - 10-minute TTL (600,000 ms)
 * - Keyed by SHA-256 of the masked text
 * - Note: NEVER cache chat replies (enforced by design: chat does not invoke this cache)
 */
export class Layer2Cache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries = 200, ttlMs = 10 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Generates SHA-256 hex digest key for masked text.
   */
  public static hashKey(maskedText: string): string {
    return crypto.createHash('sha256').update(maskedText).digest('hex');
  }

  public get(key: string): CachedLayer2Data | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU position (delete and re-insert makes it most-recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  public set(key: string, data: CachedLayer2Data): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict least-recently used (oldest entry in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  public has(key: string): boolean {
    return this.get(key) !== null;
  }

  public size(): number {
    return this.cache.size;
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

// Global Layer 2 LRU Cache singleton (200 entries, 10 min TTL)
export const layer2Cache = new Layer2Cache(200, 10 * 60 * 1000);
