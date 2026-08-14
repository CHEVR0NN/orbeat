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

export interface GraphNode {
  id: string;
  kind: "core" | "candidate";
  relevance: number;
  listeners: number;
  sourceCoreArtist?: string;
  match?: number;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface UserProfile {
  name: string;
  image: string | null;
  playcount: number;
}

export interface TopAlbum {
  name: string;
  artist: string;
  image: string | null;
}

export interface ProfileDataBundle {
  profile: UserProfile;
  topAlbums: TopAlbum[];
}

export interface NowPlayingTrack {
  name: string;
  artist: string;
  album: string | null;
  nowPlaying: boolean;
}

export interface GenreCount {
  name: string;
  count: number;
}

export interface ScrobbleEvent {
  artist: string;
  timestamp: number; // ms since epoch
}
