import { getTopArtists, getTopTags, getSimilar, getInfo } from "./lastfm";
import { cacheKey, getCachedOrFetch } from "./cache";
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

export async function fetchGraphData(
  settings: Settings,
  period: Period,
  fetchers: Fetchers = DEFAULT_FETCHERS,
  requestDelayMs: number = REQUEST_DELAY_MS,
  forceRefresh = false
): Promise<GraphDataBundle> {
  const { data: core } = await getCachedOrFetch(
    cacheKey("topArtists", settings.username, period),
    () => fetchers.getTopArtists(settings.apiKey, settings.username, period),
    forceRefresh
  );

  const tagsByArtist: GraphDataBundle["tagsByArtist"] = {};
  const similarByArtist: GraphDataBundle["similarByArtist"] = {};

  for (const artist of core) {
    const tagsResult = await getCachedOrFetch(
      cacheKey("topTags", artist.name),
      () => fetchers.getTopTags(settings.apiKey, artist.name),
      forceRefresh
    );
    tagsByArtist[artist.name] = tagsResult.data;
    if (!tagsResult.fromCache) await delay(requestDelayMs);

    const similarResult = await getCachedOrFetch(
      cacheKey("similar", artist.name),
      () => fetchers.getSimilar(settings.apiKey, artist.name, 10),
      forceRefresh
    );
    similarByArtist[artist.name] = similarResult.data;
    if (!similarResult.fromCache) await delay(requestDelayMs);
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
    const { data: info, fromCache } = await getCachedOrFetch(
      cacheKey("info", name),
      () => fetchers.getInfo(settings.apiKey, name),
      forceRefresh
    );
    if (info) infoByArtist[name] = info;
    if (!fromCache) await delay(requestDelayMs);
  }

  return { core, tagsByArtist, similarByArtist, infoByArtist };
}
