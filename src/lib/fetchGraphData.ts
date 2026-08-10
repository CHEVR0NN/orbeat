import { getTopArtists, getTopTags, getSimilar, getInfo } from "./lastfm";
import { cacheKey, readCache, writeCache, isStale } from "./cache";
import type { Settings, Period, GraphDataBundle } from "../types";

interface Fetchers {
  getTopArtists: typeof getTopArtists;
  getTopTags: typeof getTopTags;
  getSimilar: typeof getSimilar;
  getInfo: typeof getInfo;
}

const DEFAULT_FETCHERS: Fetchers = { getTopArtists, getTopTags, getSimilar, getInfo };
const REQUEST_DELAY_MS = 250;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function getCachedOrFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const cached = readCache<T>(key);
  if (!isStale(cached)) return cached!.data;
  const data = await fetchFn();
  writeCache(key, data);
  return data;
}

export async function fetchGraphData(
  settings: Settings,
  period: Period,
  fetchers: Fetchers = DEFAULT_FETCHERS,
  requestDelayMs: number = REQUEST_DELAY_MS
): Promise<GraphDataBundle> {
  const core = await getCachedOrFetch(cacheKey("topArtists", settings.username, period), () =>
    fetchers.getTopArtists(settings.apiKey, settings.username, period)
  );

  const tagsByArtist: GraphDataBundle["tagsByArtist"] = {};
  const similarByArtist: GraphDataBundle["similarByArtist"] = {};

  for (const artist of core) {
    tagsByArtist[artist.name] = await getCachedOrFetch(cacheKey("topTags", artist.name), () =>
      fetchers.getTopTags(settings.apiKey, artist.name)
    );
    await delay(requestDelayMs);
    similarByArtist[artist.name] = await getCachedOrFetch(cacheKey("similar", artist.name), () =>
      fetchers.getSimilar(settings.apiKey, artist.name, 10)
    );
    await delay(requestDelayMs);
  }

  const coreNames = new Set(core.map((a) => a.name));
  const candidateNames = new Set<string>();
  for (const similar of Object.values(similarByArtist)) {
    for (const s of similar) {
      if (!coreNames.has(s.name)) candidateNames.add(s.name);
    }
  }

  const infoByArtist: GraphDataBundle["infoByArtist"] = {};
  for (const name of [...core.map((a) => a.name), ...candidateNames]) {
    const info = await getCachedOrFetch(cacheKey("info", name), () =>
      fetchers.getInfo(settings.apiKey, name)
    );
    if (info) infoByArtist[name] = info;
    await delay(requestDelayMs);
  }

  return { core, tagsByArtist, similarByArtist, infoByArtist };
}
