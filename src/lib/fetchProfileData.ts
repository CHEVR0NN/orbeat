import { getUserInfo, getTopAlbums } from "./lastfm";
import { cacheKey, getCachedOrFetch } from "./cache";
import type { Settings, ProfileDataBundle } from "../types";

interface ProfileFetchers {
  getUserInfo: typeof getUserInfo;
  getTopAlbums: typeof getTopAlbums;
}

const DEFAULT_FETCHERS: ProfileFetchers = { getUserInfo, getTopAlbums };

export async function fetchProfileData(
  settings: Settings,
  fetchers: ProfileFetchers = DEFAULT_FETCHERS,
  forceRefresh = false
): Promise<ProfileDataBundle> {
  const { data: profile } = await getCachedOrFetch(
    cacheKey("userProfile", settings.username),
    () => fetchers.getUserInfo(settings.apiKey, settings.username),
    forceRefresh
  );

  const { data: albums } = await getCachedOrFetch(
    cacheKey("topAlbums", settings.username),
    () => fetchers.getTopAlbums(settings.apiKey, settings.username, 1),
    forceRefresh
  );

  return { profile, topAlbum: albums[0] ?? null };
}
