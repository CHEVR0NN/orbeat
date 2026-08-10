export interface Settings {
  apiKey: string;
  username: string;
}

export interface CacheEntry<T> {
  fetchedAt: number;
  data: T;
}
