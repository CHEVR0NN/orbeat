import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getTopArtists,
  getTopTags,
  getSimilar,
  getInfo,
  getUserInfo,
  getTopAlbums,
  getRecentTracksHistory,
  LastfmError,
} from "./lastfm";

function mockFetchOnce(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () => Promise.resolve(body),
    })
  );
}

function mockFetchSequence(bodies: unknown[]) {
  const fn = vi.fn();
  for (const body of bodies) {
    fn.mockResolvedValueOnce({ json: () => Promise.resolve(body) });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
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

  it("getUserInfo maps name, largest avatar image, and total scrobble count", async () => {
    mockFetchOnce({
      user: {
        name: "kai",
        playcount: "48213",
        image: [
          { size: "small", "#text": "small.jpg" },
          { size: "extralarge", "#text": "large.jpg" },
        ],
      },
    });
    const result = await getUserInfo("key", "kai");
    expect(result).toEqual({ name: "kai", image: "large.jpg", playcount: 48213 });
  });

  it("getUserInfo returns null image when Last.fm has no avatar set", async () => {
    mockFetchOnce({
      user: { name: "kai", playcount: "0", image: [{ size: "extralarge", "#text": "" }] },
    });
    const result = await getUserInfo("key", "kai");
    expect(result.image).toBeNull();
  });

  it("getTopAlbums maps album name, artist name, and largest cover image", async () => {
    mockFetchOnce({
      topalbums: {
        album: [
          {
            name: "OK Computer",
            artist: { name: "Radiohead" },
            image: [
              { size: "small", "#text": "small.jpg" },
              { size: "extralarge", "#text": "large.jpg" },
            ],
          },
        ],
      },
    });
    const result = await getTopAlbums("key", "kai", 1);
    expect(result).toEqual([{ name: "OK Computer", artist: "Radiohead", image: "large.jpg" }]);
  });

  it("getTopAlbums returns null image when the album has no cover art", async () => {
    mockFetchOnce({
      topalbums: {
        album: [
          { name: "OK Computer", artist: { name: "Radiohead" }, image: [{ size: "extralarge", "#text": "" }] },
        ],
      },
    });
    const result = await getTopAlbums("key", "kai", 1);
    expect(result[0].image).toBeNull();
  });

  it("getTopAlbums returns null image when the image array is missing", async () => {
    mockFetchOnce({
      topalbums: { album: [{ name: "OK Computer", artist: { name: "Radiohead" } }] },
    });
    const result = await getTopAlbums("key", "kai", 1);
    expect(result[0].image).toBeNull();
  });

  it("getTopAlbums returns an empty array when the user has no scrobbled albums", async () => {
    mockFetchOnce({ topalbums: { album: [] } });
    const result = await getTopAlbums("key", "kai", 1);
    expect(result).toEqual([]);
  });

  it("getRecentTracksHistory maps tracks into ScrobbleEvent[] with correct timestamp math", async () => {
    mockFetchOnce({
      recenttracks: {
        track: [
          { artist: { "#text": "Radiohead" }, date: { uts: "1700000000" } },
          { artist: { "#text": "Aphex Twin" }, date: { uts: "1700000100" } },
        ],
      },
    });
    const result = await getRecentTracksHistory("key", "kai", { pages: 1, limit: 200 });
    expect(result).toEqual([
      { artist: "Radiohead", timestamp: 1700000000 * 1000 },
      { artist: "Aphex Twin", timestamp: 1700000100 * 1000 },
    ]);
  });

  it("getRecentTracksHistory skips the now-playing entry that has no date", async () => {
    mockFetchOnce({
      recenttracks: {
        track: [
          { artist: { "#text": "Now Playing Artist" }, "@attr": { nowplaying: "true" } },
          { artist: { "#text": "Radiohead" }, date: { uts: "1700000000" } },
        ],
      },
    });
    const result = await getRecentTracksHistory("key", "kai", { pages: 1, limit: 200 });
    expect(result).toEqual([{ artist: "Radiohead", timestamp: 1700000000 * 1000 }]);
  });

  it("getRecentTracksHistory stops paginating when a page comes back short", async () => {
    const fullPage = Array.from({ length: 2 }, (_, i) => ({
      artist: { "#text": `Artist ${i}` },
      date: { uts: String(1700000000 + i) },
    }));
    const shortPage = [{ artist: { "#text": "Last Artist" }, date: { uts: "1700000200" } }];
    const fetchMock = mockFetchSequence([
      { recenttracks: { track: fullPage } },
      { recenttracks: { track: shortPage } },
    ]);
    const result = await getRecentTracksHistory("key", "kai", { pages: 3, limit: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(3);
  });
});
