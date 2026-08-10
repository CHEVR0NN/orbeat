export interface Settings {
  apiKey: string;
  username: string;
}

export interface CacheEntry<T> {
  fetchedAt: number;
  data: T;
}

export type Period = "7day" | "1month" | "3month" | "6month" | "12month" | "overall";

export interface TopArtist {
  name: string;
  mbid: string;
  playcount: number;
  rank: number;
}

export interface ArtistTag {
  name: string;
  count: number;
}

export interface SimilarArtist {
  name: string;
  match: number;
}

export interface ArtistInfo {
  name: string;
  listeners: number;
  playcount: number;
}

export interface GraphDataBundle {
  core: TopArtist[];
  tagsByArtist: Record<string, ArtistTag[]>;
  similarByArtist: Record<string, SimilarArtist[]>;
  infoByArtist: Record<string, ArtistInfo>;
}
