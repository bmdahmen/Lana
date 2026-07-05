"use client";

const DEFAULT_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Module-scoped, so it survives client-side route/tab navigation within the
// app but resets on a full page reload -- that's fine, a hard reload is
// exactly when re-fetching from the server is expected.
const cache = new Map<string, CacheEntry<unknown>>();

export function getCachedFetch<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCachedFetch<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCachedFetch(key: string): void {
  cache.delete(key);
}
