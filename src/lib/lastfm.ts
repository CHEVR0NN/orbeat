import type {
  Period,
  TopArtist,
  ArtistTag,
  SimilarArtist,
  ArtistInfo,
  UserProfile,
  TopAlbum,
} from "../types";

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const CORE_ARTIST_COUNT = 5;

export class LastfmError extends Error {}

async function call(params: Record<string, string>, apiKey: string): Promise<any> {
  const url = new URL(BASE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) {
    throw new LastfmError(json.message ?? `Last.fm error ${json.error}`);
  }
  return json;
}

export async function getTopArtists(
  apiKey: string,
  username: string,
  period: Period,
  limit = CORE_ARTIST_COUNT
): Promise<TopArtist[]> {
  const json = await call(
    { method: "user.gettopartists", user: username, period, limit: String(limit) },
    apiKey
  );
  const artists = json.topartists?.artist ?? [];
  return artists.map((a: any, i: number) => ({
    name: a.name,
    mbid: a.mbid ?? "",
    playcount: Number(a.playcount ?? 0),
    rank: i + 1,
  }));
}

export async function getTopTags(apiKey: string, artist: string): Promise<ArtistTag[]> {
  const json = await call({ method: "artist.gettoptags", artist }, apiKey);
  const tags = json.toptags?.tag ?? [];
  return tags.map((t: any) => ({ name: t.name, count: Number(t.count ?? 0) }));
}

export async function getSimilar(
  apiKey: string,
  artist: string,
  limit = 10
): Promise<SimilarArtist[]> {
  const json = await call({ method: "artist.getsimilar", artist, limit: String(limit) }, apiKey);
  const similar = json.similarartists?.artist ?? [];
  return similar.map((a: any) => ({ name: a.name, match: Number(a.match ?? 0) }));
}

export async function getInfo(apiKey: string, artist: string): Promise<ArtistInfo | null> {
  const json = await call({ method: "artist.getinfo", artist }, apiKey);
  const info = json.artist;
  if (!info) return null;
  return {
    name: info.name,
    listeners: Number(info.stats?.listeners ?? 0),
    playcount: Number(info.stats?.playcount ?? 0),
  };
}

export async function getUserInfo(apiKey: string, username: string): Promise<UserProfile> {
  const json = await call({ method: "user.getinfo", user: username }, apiKey);
  const user = json.user ?? {};
  const images = user.image ?? [];
  const largest = images.find((i: any) => i.size === "extralarge")?.["#text"] ?? "";
  return {
    name: user.name ?? username,
    image: largest ? largest : null,
    playcount: Number(user.playcount ?? 0),
  };
}

export async function getTopAlbums(
  apiKey: string,
  username: string,
  limit = 1
): Promise<TopAlbum[]> {
  const json = await call(
    { method: "user.gettopalbums", user: username, limit: String(limit) },
    apiKey
  );
  const albums = json.topalbums?.album ?? [];
  return albums.map((a: any) => ({ name: a.name, artist: a.artist?.name ?? "" }));
}
