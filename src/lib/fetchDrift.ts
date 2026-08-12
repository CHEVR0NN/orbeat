import { getTopArtists } from "./lastfm";
import { cacheKey, getCachedOrFetch } from "./cache";
import type { Settings, Period, TopArtist } from "../types";

interface DriftFetchers {
  getTopArtists: typeof getTopArtists;
}

const DEFAULT_FETCHERS: DriftFetchers = { getTopArtists };

export async function fetchDriftData(
  settings: Settings,
  recentPeriod: Period,
  baselinePeriod: Period,
  fetchers: DriftFetchers = DEFAULT_FETCHERS,
  forceRefresh = false
): Promise<{ recent: TopArtist[]; baseline: TopArtist[] }> {
  const [{ data: recent }, { data: baseline }] = await Promise.all([
    getCachedOrFetch(
      cacheKey("topArtists", settings.username, recentPeriod),
      () => fetchers.getTopArtists(settings.apiKey, settings.username, recentPeriod),
      forceRefresh
    ),
    getCachedOrFetch(
      cacheKey("topArtists", settings.username, baselinePeriod),
      () => fetchers.getTopArtists(settings.apiKey, settings.username, baselinePeriod),
      forceRefresh
    ),
  ]);

  return { recent, baseline };
}
