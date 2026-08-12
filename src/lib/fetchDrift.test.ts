import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchDriftData } from "./fetchDrift";
import type { TopArtist } from "../types";

function makeFetchers() {
  const getTopArtists = vi.fn(
    async (_apiKey: string, _username: string, period: string): Promise<TopArtist[]> => [
      { name: `${period} Artist`, mbid: "", playcount: 100, rank: 1 },
    ]
  );
  return { getTopArtists };
}

describe("fetchDriftData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("fetches both the recent and baseline periods", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    const bundle = await fetchDriftData(settings, "3month", "12month", fetchers);

    expect(bundle.recent).toEqual([{ name: "3month Artist", mbid: "", playcount: 100, rank: 1 }]);
    expect(bundle.baseline).toEqual([
      { name: "12month Artist", mbid: "", playcount: 100, rank: 1 },
    ]);
    expect(fetchers.getTopArtists).toHaveBeenCalledTimes(2);
  });

  it("reuses cached data on an identical second call", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    await fetchDriftData(settings, "3month", "12month", fetchers);
    await fetchDriftData(settings, "3month", "12month", fetchers);
    expect(fetchers.getTopArtists).toHaveBeenCalledTimes(2);
  });

  it("refetches only the changed period when one period changes", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    await fetchDriftData(settings, "3month", "12month", fetchers);
    await fetchDriftData(settings, "6month", "12month", fetchers);

    // Original 2 calls (3month + 12month) + 1 more for the newly-requested
    // 6month period. The 12month call count should not have grown again.
    expect(fetchers.getTopArtists).toHaveBeenCalledTimes(3);
    const periodsCalled = fetchers.getTopArtists.mock.calls.map((c) => c[2]);
    expect(periodsCalled.filter((p) => p === "12month")).toHaveLength(1);
    expect(periodsCalled.filter((p) => p === "6month")).toHaveLength(1);
  });

  it("forceRefresh bypasses the cache for both periods", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    await fetchDriftData(settings, "3month", "12month", fetchers);
    await fetchDriftData(settings, "3month", "12month", fetchers, true);
    expect(fetchers.getTopArtists).toHaveBeenCalledTimes(4);
  });
});
