import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchProfileData } from "./fetchProfileData";
import type { UserProfile, TopAlbum } from "../types";

function makeFetchers() {
  const getUserInfo = vi.fn(
    async (): Promise<UserProfile> => ({ name: "kai", image: "avatar.jpg", playcount: 48213 })
  );
  const getTopAlbums = vi.fn(
    async (): Promise<TopAlbum[]> => [{ name: "OK Computer", artist: "Radiohead" }]
  );
  return { getUserInfo, getTopAlbums };
}

describe("fetchProfileData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fetches profile and top album", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    const bundle = await fetchProfileData(settings, fetchers);

    expect(bundle.profile).toEqual({ name: "kai", image: "avatar.jpg", playcount: 48213 });
    expect(bundle.topAlbum).toEqual({ name: "OK Computer", artist: "Radiohead" });
  });

  it("returns null topAlbum when the user has no scrobbled albums", async () => {
    const fetchers = makeFetchers();
    fetchers.getTopAlbums.mockResolvedValueOnce([]);
    const settings = { apiKey: "key", username: "kai" };
    const bundle = await fetchProfileData(settings, fetchers);
    expect(bundle.topAlbum).toBeNull();
  });

  it("reuses cached data on a second call instead of refetching", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    await fetchProfileData(settings, fetchers);
    await fetchProfileData(settings, fetchers);
    expect(fetchers.getUserInfo).toHaveBeenCalledTimes(1);
    expect(fetchers.getTopAlbums).toHaveBeenCalledTimes(1);
  });

  it("forceRefresh bypasses the cache", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    await fetchProfileData(settings, fetchers);
    await fetchProfileData(settings, fetchers, true);
    expect(fetchers.getUserInfo).toHaveBeenCalledTimes(2);
  });
});
