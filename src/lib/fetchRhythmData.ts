import { getRecentTracksHistory } from "./lastfm";
import { cacheKey, getCachedOrFetch } from "./cache";
import type { Settings, ScrobbleEvent } from "../types";

interface RhythmFetchers {
  getRecentTracksHistory: typeof getRecentTracksHistory;
}

const DEFAULT_FETCHERS: RhythmFetchers = { getRecentTracksHistory };

export async function fetchRhythmData(
  settings: Settings,
  fetchers: RhythmFetchers = DEFAULT_FETCHERS,
  forceRefresh = false
): Promise<ScrobbleEvent[]> {
  const { data } = await getCachedOrFetch(
    cacheKey("rhythm", settings.username),
    () => fetchers.getRecentTracksHistory(settings.apiKey, settings.username),
    forceRefresh
  );
  return data;
}
