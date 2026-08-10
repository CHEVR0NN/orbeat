import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchGraphData } from "./fetchGraphData";
import type { TopArtist, ArtistTag, SimilarArtist, ArtistInfo } from "../types";

const core: TopArtist[] = [
  { name: "Radiohead", mbid: "", playcount: 500, rank: 1 },
  { name: "Aphex Twin", mbid: "", playcount: 300, rank: 2 },
];

function makeFetchers() {
  const getTopArtists = vi.fn(async () => core);
  const getTopTags = vi.fn(
    async (_key: string, artist: string): Promise<ArtistTag[]> => [
      { name: `${artist}-tag`, count: 10 },
    ]
  );
  const getSimilar = vi.fn(
    async (_key: string, artist: string): Promise<SimilarArtist[]> => [
      { name: artist === "Radiohead" ? "Aphex Twin" : "Boards of Canada", match: 0.9 },
    ]
  );
  const getInfo = vi.fn(
    async (_key: string, artist: string): Promise<ArtistInfo> => ({
      name: artist,
      listeners: 1000,
      playcount: 2000,
    })
  );
  return { getTopArtists, getTopTags, getSimilar, getInfo };
}

describe("fetchGraphData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fetches core artists, tags, similar artists and info, deduping core from candidates", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    const bundle = await fetchGraphData(settings, "overall", fetchers, 0);

    expect(bundle.core).toEqual(core);
    expect(fetchers.getSimilar).toHaveBeenCalledTimes(2);
    expect(fetchers.getInfo).toHaveBeenCalledTimes(3);
    expect(Object.keys(bundle.infoByArtist).sort()).toEqual(
      ["Aphex Twin", "Boards of Canada", "Radiohead"].sort()
    );
  });

  it("reuses cached data on a second call instead of refetching", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    await fetchGraphData(settings, "overall", fetchers, 0);
    await fetchGraphData(settings, "overall", fetchers, 0);

    expect(fetchers.getTopArtists).toHaveBeenCalledTimes(1);
    expect(fetchers.getTopTags).toHaveBeenCalledTimes(2);
  });
});
