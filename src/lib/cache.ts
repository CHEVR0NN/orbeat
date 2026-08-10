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
