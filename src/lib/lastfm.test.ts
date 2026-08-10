import { describe, it, expect, vi, afterEach } from "vitest";
import { getTopArtists, getTopTags, getSimilar, getInfo, LastfmError } from "./lastfm";

function mockFetchOnce(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(body),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lastfm", () => {
  it("getTopArtists maps the response into ranked TopArtist objects", async () => {
    mockFetchOnce({
      topartists: {
        artist: [
          { name: "Radiohead", mbid: "abc", playcount: "500" },
          { name: "Aphex Twin", mbid: "", playcount: "300" },
        ],
      },
    });
    const result = await getTopArtists("key", "kai", "overall");
    expect(result).toEqual([
      { name: "Radiohead", mbid: "abc", playcount: 500, rank: 1 },
      { name: "Aphex Twin", mbid: "", playcount: 300, rank: 2 },
    ]);
  });

  it("getTopTags maps tag names and counts", async () => {
    mockFetchOnce({ toptags: { tag: [{ name: "idm", count: "80" }] } });
    const result = await getTopTags("key", "Aphex Twin");
    expect(result).toEqual([{ name: "idm", count: 80 }]);
  });

  it("getSimilar maps names and match scores", async () => {
    mockFetchOnce({
      similarartists: { artist: [{ name: "Boards of Canada", match: "0.87" }] },
    });
    const result = await getSimilar("key", "Aphex Twin", 10);
    expect(result).toEqual([{ name: "Boards of Canada", match: 0.87 }]);
  });

  it("getInfo maps listener and playcount stats", async () => {
    mockFetchOnce({
      artist: { name: "Radiohead", stats: { listeners: "4000000", playcount: "900000000" } },
    });
    const result = await getInfo("key", "Radiohead");
    expect(result).toEqual({ name: "Radiohead", listeners: 4000000, playcount: 900000000 });
  });

  it("getInfo returns null when Last.fm has no record for the artist", async () => {
    mockFetchOnce({});
    const result = await getInfo("key", "Some Unknown Act");
    expect(result).toBeNull();
  });

  it("throws LastfmError when the API responds with an error payload", async () => {
    mockFetchOnce({ error: 6, message: "The artist you supplied could not be found" });
    await expect(getTopTags("key", "???")).rejects.toThrow(LastfmError);
  });
});
