import type { CacheEntry } from "../types";

const PREFIX = "orbeat_cache_";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function cacheKey(kind: string, ...parts: string[]): string {
  return `${PREFIX}${kind}:${parts.join(":")}`;
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { fetchedAt: Date.now(), data };
  localStorage.setItem(key, JSON.stringify(entry));
}

export function isStale(entry: CacheEntry<unknown> | null, maxAgeMs = MAX_AGE_MS): boolean {
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > maxAgeMs;
}

/**
 * Reads a cache entry for `key`; if missing/stale (or `forceRefresh` is
 * true), calls `fetchFn`, writes the result to cache, and returns it.
 * `forceRefresh` skips the freshness check but still writes to cache —
 * it does not disable caching.
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  forceRefresh = false
): Promise<{ data: T; fromCache: boolean }> {
  const cached = readCache<T>(key);
  if (!forceRefresh && !isStale(cached)) return { data: cached!.data, fromCache: true };
  const data = await fetchFn();
  writeCache(key, data);
  return { data, fromCache: false };
}
