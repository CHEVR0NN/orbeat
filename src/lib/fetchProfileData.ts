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
  const [{ data: profile }, { data: albums }] = await Promise.all([
    getCachedOrFetch(
      cacheKey("userProfile", settings.username),
      () => fetchers.getUserInfo(settings.apiKey, settings.username),
      forceRefresh
    ),
    getCachedOrFetch(
      cacheKey("topAlbums", settings.username),
      () => fetchers.getTopAlbums(settings.apiKey, settings.username, 10),
      forceRefresh
    ),
  ]);

  return { profile, topAlbums: albums };
}
