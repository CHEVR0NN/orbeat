import { describe, it, expect, beforeEach, vi } from "vitest";
import { cacheKey, readCache, writeCache, isStale, getCachedOrFetch } from "./cache";

describe("cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("cacheKey joins parts with colons", () => {
    expect(cacheKey("topTags", "Radiohead")).toBe("orbeat_cache_topTags:Radiohead");
  });

  it("readCache returns null when missing", () => {
    expect(readCache("missing-key")).toBeNull();
  });

  it("writeCache then readCache round-trips data and sets fetchedAt", () => {
    const before = Date.now();
    writeCache("k", { hello: "world" });
    const entry = readCache<{ hello: string }>("k");
    expect(entry).not.toBeNull();
    expect(entry!.data).toEqual({ hello: "world" });
    expect(entry!.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  it("isStale is true for a missing entry", () => {
    expect(isStale(null)).toBe(true);
  });

  it("isStale is false for a fresh entry", () => {
    writeCache("k", "data");
    const entry = readCache<string>("k");
    expect(isStale(entry)).toBe(false);
  });

  it("isStale is true once maxAgeMs has elapsed", () => {
    vi.useFakeTimers();
    writeCache("k", "data");
    const entry = readCache<string>("k");
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(isStale(entry)).toBe(true);
    vi.useRealTimers();
  });

  it("readCache accepts valid JSON that doesn't match CacheEntry shape", () => {
    localStorage.setItem("weird-key", JSON.stringify({ not: "a cache entry" }));
    const entry = readCache("weird-key");
    expect(entry).not.toBeNull();
    expect(entry).toEqual({ not: "a cache entry" });
  });

  it("getCachedOrFetch returns cached data without calling fetchFn when fresh", async () => {
    writeCache("k", "cached-value");
    const fetchFn = vi.fn(async () => "fresh-value");
    const result = await getCachedOrFetch("k", fetchFn);
    expect(result).toEqual({ data: "cached-value", fromCache: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("getCachedOrFetch calls fetchFn and writes cache when missing", async () => {
    const fetchFn = vi.fn(async () => "fresh-value");
    const result = await getCachedOrFetch("k", fetchFn);
    expect(result).toEqual({ data: "fresh-value", fromCache: false });
    expect(readCache<string>("k")?.data).toBe("fresh-value");
  });

  it("getCachedOrFetch with forceRefresh bypasses a fresh cache entry", async () => {
    writeCache("k", "cached-value");
    const fetchFn = vi.fn(async () => "fresh-value");
    const result = await getCachedOrFetch("k", fetchFn, true);
    expect(result).toEqual({ data: "fresh-value", fromCache: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(readCache<string>("k")?.data).toBe("fresh-value");
  });
});
