# Orbeat Phase 1: Data Foundation + Taste Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold Orbeat (Vite + React + TypeScript), build the Last.fm data
layer (fetch + localStorage cache), and render the Taste Map — a
force-directed graph of the user's top artists (core) and similarity-ranked
candidates (radiating outward) — ending at the style-prototype checkpoint
from the spec's build order (step 4).

**Out of scope for this plan** (covered by later plans, per
`docs/superpowers/specs/2026-08-10-orbeat-design.md`): Deep Cuts lens,
Drift lens, and the rate-limit/cache-fallback robustness described under
"Polish pass" (spec build-order step 7). Error states implemented here are
limited to what's needed for a working settings flow (invalid key/username)
and sparse-artist omission — both already fully specified.

**Architecture:** Pure data/logic modules (`src/lib/`) are unit-tested with
Vitest and have zero DOM dependencies. `App.tsx` wires settings → fetch →
graph-building → `TasteMap` rendering. `TasteMap.tsx` owns the SVG; a
`d3-force` simulation only computes node positions each tick, React renders
the DOM from that data — no imperative d3 DOM manipulation.

**Tech Stack:** Vite, React 18, TypeScript, Vitest (jsdom environment),
d3-force (added in Task 9, when first used). No router, no CSS framework
(plain CSS + CSS custom properties for the palette).

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "orbeat",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 2: Write `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Orbeat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules
dist
*.local
```

- [ ] **Step 7: Write `src/index.css`**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
```

- [ ] **Step 8: Write `src/App.tsx`**

```tsx
export default function App() {
  return <div>Orbeat</div>;
}
```

- [ ] **Step 9: Write `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 10: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 11: Verify the build works**

Run: `npm run build`
Expected: completes with no TypeScript errors, produces a `dist/` folder.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html .gitignore src/
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

## Task 2: Settings module (API key/username storage) + Vitest wiring

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/types.ts`
- Create: `src/lib/settings.ts`
- Test: `src/lib/settings.test.ts`

- [ ] **Step 1: Install Vitest and jsdom**

Run: `npm install -D vitest jsdom`

- [ ] **Step 2: Add the test script and Vitest config**

Modify `package.json` — the `scripts` block already has `"test": "vitest run"` from Task 1; verify it's there (no change needed if so).

Modify `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { readSettings, writeSettings, clearSettings } from "./settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing stored", () => {
    expect(readSettings()).toBeNull();
  });

  it("round-trips a written settings object", () => {
    writeSettings({ apiKey: "abc123", username: "kai" });
    expect(readSettings()).toEqual({ apiKey: "abc123", username: "kai" });
  });

  it("returns null for malformed stored data", () => {
    localStorage.setItem("orbeat_settings", "{not json");
    expect(readSettings()).toBeNull();
  });

  it("returns null after clearSettings", () => {
    writeSettings({ apiKey: "abc123", username: "kai" });
    clearSettings();
    expect(readSettings()).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test, confirm it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./settings`.

- [ ] **Step 5: Write `src/types.ts`**

```ts
export interface Settings {
  apiKey: string;
  username: string;
}
```

- [ ] **Step 6: Write `src/lib/settings.ts`**

```ts
import type { Settings } from "../types";

const KEY = "orbeat_settings";

export function readSettings(): Settings | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.apiKey === "string" &&
      typeof parsed.username === "string" &&
      parsed.apiKey &&
      parsed.username
    ) {
      return parsed as Settings;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSettings(settings: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function clearSettings(): void {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 7: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS — 4 tests passed.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/types.ts src/lib/settings.ts src/lib/settings.test.ts
git commit -m "feat: add settings module with Vitest wired up"
```

---

## Task 3: Cache module

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/cache.ts`
- Test: `src/lib/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/cache.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cacheKey, readCache, writeCache, isStale } from "./cache";

describe("cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("cacheKey joins parts with colons", () => {
    expect(cacheKey("topTags", "Radiohead")).toBe("orbeat_cache_topTags:Radiohead");
  });

  it("readCache returns null when missing", () => {
    expect(readCache("missing-key")).toBeNull();
  });

  it("writeCache then readCache round-trips data and sets fetchedAt", () => {
    const before = Date.now();
    writeCache("k", { hello: "world" });
    const entry = readCache<{ hello: string }>("k");
    expect(entry).not.toBeNull();
    expect(entry!.data).toEqual({ hello: "world" });
    expect(entry!.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  it("isStale is true for a missing entry", () => {
    expect(isStale(null)).toBe(true);
  });

  it("isStale is false for a fresh entry", () => {
    writeCache("k", "data");
    const entry = readCache<string>("k");
    expect(isStale(entry)).toBe(false);
  });

  it("isStale is true once maxAgeMs has elapsed", () => {
    vi.useFakeTimers();
    writeCache("k", "data");
    const entry = readCache<string>("k");
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(isStale(entry)).toBe(true);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./cache`.

- [ ] **Step 3: Add `CacheEntry<T>` to `src/types.ts`**

Add to `src/types.ts`:

```ts
export interface CacheEntry<T> {
  fetchedAt: number;
  data: T;
}
```

- [ ] **Step 4: Write `src/lib/cache.ts`**

```ts
import type { CacheEntry } from "../types";

const PREFIX = "orbeat_cache_";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function cacheKey(kind: string, ...parts: string[]): string {
  return `${PREFIX}${kind}:${parts.join(":")}`;
}

export function readCache<T>(key: string): CacheEntry<T> | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { fetchedAt: Date.now(), data };
  localStorage.setItem(key, JSON.stringify(entry));
}

export function isStale(entry: CacheEntry<unknown> | null, maxAgeMs = MAX_AGE_MS): boolean {
  if (!entry) return true;
  return Date.now() - entry.fetchedAt > maxAgeMs;
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS — all tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/cache.ts src/lib/cache.test.ts
git commit -m "feat: add localStorage cache module with staleness check"
```

---

## Task 4: Last.fm API wrapper

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/lastfm.ts`
- Test: `src/lib/lastfm.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/lastfm.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./lastfm`.

- [ ] **Step 3: Add data types to `src/types.ts`**

Add to `src/types.ts`:

```ts
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
```

- [ ] **Step 4: Write `src/lib/lastfm.ts`**

```ts
import type { Period, TopArtist, ArtistTag, SimilarArtist, ArtistInfo } from "../types";

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
  period: Period
): Promise<TopArtist[]> {
  const json = await call(
    { method: "user.gettopartists", user: username, period, limit: String(CORE_ARTIST_COUNT) },
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
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS — all tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/lastfm.ts src/lib/lastfm.test.ts
git commit -m "feat: add Last.fm API wrapper"
```

---

## Task 5: Data fetch orchestration (fan-out + caching)

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/fetchGraphData.ts`
- Test: `src/lib/fetchGraphData.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/fetchGraphData.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./fetchGraphData`.

- [ ] **Step 3: Add `GraphDataBundle` to `src/types.ts`**

Add to `src/types.ts`:

```ts
export interface GraphDataBundle {
  core: TopArtist[];
  tagsByArtist: Record<string, ArtistTag[]>;
  similarByArtist: Record<string, SimilarArtist[]>;
  infoByArtist: Record<string, ArtistInfo>;
}
```

- [ ] **Step 4: Write `src/lib/fetchGraphData.ts`**

```ts
import { getTopArtists, getTopTags, getSimilar, getInfo } from "./lastfm";
import { cacheKey, readCache, writeCache, isStale } from "./cache";
import type { Settings, Period, GraphDataBundle } from "../types";

interface Fetchers {
  getTopArtists: typeof getTopArtists;
  getTopTags: typeof getTopTags;
  getSimilar: typeof getSimilar;
  getInfo: typeof getInfo;
}

const DEFAULT_FETCHERS: Fetchers = { getTopArtists, getTopTags, getSimilar, getInfo };
const REQUEST_DELAY_MS = 250;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function getCachedOrFetch<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const cached = readCache<T>(key);
  if (!isStale(cached)) return cached!.data;
  const data = await fetchFn();
  writeCache(key, data);
  return data;
}

export async function fetchGraphData(
  settings: Settings,
  period: Period,
  fetchers: Fetchers = DEFAULT_FETCHERS,
  requestDelayMs: number = REQUEST_DELAY_MS
): Promise<GraphDataBundle> {
  const core = await getCachedOrFetch(cacheKey("topArtists", settings.username, period), () =>
    fetchers.getTopArtists(settings.apiKey, settings.username, period)
  );

  const tagsByArtist: GraphDataBundle["tagsByArtist"] = {};
  const similarByArtist: GraphDataBundle["similarByArtist"] = {};

  for (const artist of core) {
    tagsByArtist[artist.name] = await getCachedOrFetch(cacheKey("topTags", artist.name), () =>
      fetchers.getTopTags(settings.apiKey, artist.name)
    );
    await delay(requestDelayMs);
    similarByArtist[artist.name] = await getCachedOrFetch(cacheKey("similar", artist.name), () =>
      fetchers.getSimilar(settings.apiKey, artist.name, 10)
    );
    await delay(requestDelayMs);
  }

  const coreNames = new Set(core.map((a) => a.name));
  const candidateNames = new Set<string>();
  for (const similar of Object.values(similarByArtist)) {
    for (const s of similar) {
      if (!coreNames.has(s.name)) candidateNames.add(s.name);
    }
  }

  const infoByArtist: GraphDataBundle["infoByArtist"] = {};
  for (const name of [...core.map((a) => a.name), ...candidateNames]) {
    const info = await getCachedOrFetch(cacheKey("info", name), () =>
      fetchers.getInfo(settings.apiKey, name)
    );
    if (info) infoByArtist[name] = info;
    await delay(requestDelayMs);
  }

  return { core, tagsByArtist, similarByArtist, infoByArtist };
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS — all tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/fetchGraphData.ts src/lib/fetchGraphData.test.ts
git commit -m "feat: add cached fetch orchestration with fan-out and dedup"
```

---

## Task 6: Graph builder (pure logic)

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/graph.ts`
- Test: `src/lib/graph.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/graph.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";
import type { GraphDataBundle } from "../types";

describe("buildGraph", () => {
  it("includes one node per core artist with relevance 1", () => {
    const bundle: GraphDataBundle = {
      core: [
        { name: "Radiohead", mbid: "", playcount: 500, rank: 1 },
        { name: "Aphex Twin", mbid: "", playcount: 300, rank: 2 },
      ],
      tagsByArtist: {},
      similarByArtist: { Radiohead: [], "Aphex Twin": [] },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
        "Aphex Twin": { name: "Aphex Twin", listeners: 500000, playcount: 90000000 },
      },
    };
    const { nodes } = buildGraph(bundle);
    const coreNodes = nodes.filter((n) => n.kind === "core");
    expect(coreNodes).toHaveLength(2);
    expect(coreNodes.every((n) => n.relevance === 1)).toBe(true);
  });

  it("omits a similar artist when Last.fm has no info for it", () => {
    const bundle: GraphDataBundle = {
      core: [{ name: "Radiohead", mbid: "", playcount: 500, rank: 1 }],
      tagsByArtist: {},
      similarByArtist: { Radiohead: [{ name: "Obscure Act", match: 0.5 }] },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
      },
    };
    const { nodes } = buildGraph(bundle);
    expect(nodes.find((n) => n.id === "Obscure Act")).toBeUndefined();
  });

  it("excludes a similar artist that is already a core artist", () => {
    const bundle: GraphDataBundle = {
      core: [
        { name: "Radiohead", mbid: "", playcount: 500, rank: 1 },
        { name: "Aphex Twin", mbid: "", playcount: 300, rank: 2 },
      ],
      tagsByArtist: {},
      similarByArtist: {
        Radiohead: [{ name: "Aphex Twin", match: 0.8 }],
        "Aphex Twin": [],
      },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
        "Aphex Twin": { name: "Aphex Twin", listeners: 500000, playcount: 90000000 },
      },
    };
    const { nodes } = buildGraph(bundle);
    expect(nodes.filter((n) => n.id === "Aphex Twin")).toHaveLength(1);
    expect(nodes.find((n) => n.id === "Aphex Twin")!.kind).toBe("core");
  });

  it("dedupes a candidate shared by two core artists, keeping the higher match score, and links both", () => {
    const bundle: GraphDataBundle = {
      core: [
        { name: "Radiohead", mbid: "", playcount: 500, rank: 1 },
        { name: "Sigur Ros", mbid: "", playcount: 300, rank: 2 },
      ],
      tagsByArtist: {},
      similarByArtist: {
        Radiohead: [{ name: "Boards of Canada", match: 0.6 }],
        "Sigur Ros": [{ name: "Boards of Canada", match: 0.9 }],
      },
      infoByArtist: {
        Radiohead: { name: "Radiohead", listeners: 4000000, playcount: 900000000 },
        "Sigur Ros": { name: "Sigur Ros", listeners: 1000000, playcount: 90000000 },
        "Boards of Canada": { name: "Boards of Canada", listeners: 300000, playcount: 5000000 },
      },
    };
    const { nodes, links } = buildGraph(bundle);
    const candidateNodes = nodes.filter((n) => n.id === "Boards of Canada");
    expect(candidateNodes).toHaveLength(1);
    expect(candidateNodes[0].relevance).toBe(0.9);
    expect(links.filter((l) => l.target === "Boards of Canada")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./graph`.

- [ ] **Step 3: Add `GraphNode`, `GraphLink`, `Graph` to `src/types.ts`**

Add to `src/types.ts`:

```ts
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
```

- [ ] **Step 4: Write `src/lib/graph.ts`**

```ts
import type { GraphDataBundle, GraphNode, GraphLink, Graph } from "../types";

export function buildGraph(bundle: GraphDataBundle): Graph {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seenCandidates = new Map<string, GraphNode>();

  for (const artist of bundle.core) {
    const info = bundle.infoByArtist[artist.name];
    nodes.push({
      id: artist.name,
      kind: "core",
      relevance: 1,
      listeners: info?.listeners ?? 0,
    });
  }

  for (const coreArtist of bundle.core) {
    const similar = bundle.similarByArtist[coreArtist.name] ?? [];
    for (const s of similar) {
      if (bundle.core.some((c) => c.name === s.name)) continue;
      const info = bundle.infoByArtist[s.name];
      if (!info) continue;

      const existing = seenCandidates.get(s.name);
      if (existing && existing.relevance >= s.match) {
        links.push({ source: coreArtist.name, target: s.name });
        continue;
      }

      const node: GraphNode = {
        id: s.name,
        kind: "candidate",
        relevance: s.match,
        listeners: info.listeners,
        sourceCoreArtist: coreArtist.name,
        match: s.match,
      };
      if (existing) {
        nodes[nodes.indexOf(existing)] = node;
      } else {
        nodes.push(node);
      }
      seenCandidates.set(s.name, node);
      links.push({ source: coreArtist.name, target: s.name });
    }
  }

  return { nodes, links };
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS — all tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/graph.ts src/lib/graph.test.ts
git commit -m "feat: add pure graph builder with dedup and relevance ranking"
```

---

## Task 7: Settings panel component

**Files:**
- Create: `src/components/SettingsPanel.tsx`

- [ ] **Step 1: Write `src/components/SettingsPanel.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { writeSettings } from "../lib/settings";
import { getTopArtists, LastfmError } from "../lib/lastfm";
import type { Settings } from "../types";

interface SettingsPanelProps {
  onSaved: (settings: Settings) => void;
}

export default function SettingsPanel({ onSaved }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!apiKey.trim() || !username.trim()) {
      setError("Enter both an API key and a Last.fm username.");
      return;
    }

    setChecking(true);
    try {
      await getTopArtists(apiKey.trim(), username.trim(), "overall");
      const settings: Settings = { apiKey: apiKey.trim(), username: username.trim() };
      writeSettings(settings);
      onSaved(settings);
    } catch (err) {
      if (err instanceof LastfmError) {
        setError(`Last.fm rejected that key/username: ${err.message}`);
      } else {
        setError("Couldn't reach Last.fm. Check your connection and try again.");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="settings-panel">
      <h1>Orbeat</h1>
      <p>
        Enter your Last.fm API key and username to build your taste map. Get a
        free key at{" "}
        <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer">
          last.fm/api/account/create
        </a>
        .
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          API key
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={checking}>
          {checking ? "Checking..." : "Build my map"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev`, open the printed local URL.
- Submit the form blank → see "Enter both an API key and a Last.fm username."
- Submit a made-up key/username → see a "Last.fm rejected that key/username" message after a moment.
- Submit a real Last.fm API key + username → no visible change yet (nothing consumes `onSaved` until Task 8), but no error and the button briefly shows "Checking...".

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat: add settings panel with API key/username validation"
```

---

## Task 8: App shell wiring (settings gate)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Rewrite `src/App.tsx`**

```tsx
import { useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import { readSettings } from "./lib/settings";
import type { Settings } from "./types";

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());

  if (!settings) {
    return <SettingsPanel onSaved={setSettings} />;
  }

  return <div>Map coming soon for {settings.username}</div>;
}
```

- [ ] **Step 2: Manually verify in the browser**

Run: `npm run dev` (if not already running).
- Open browser dev tools, clear localStorage, reload → settings panel shows.
- Submit real Last.fm API key + username → screen changes to "Map coming soon for `<username>`".
- Reload the page → goes straight to that screen (settings persisted in localStorage).

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: gate app on settings, wire settings panel into App shell"
```

---

## Task 9: Taste Map component (force-directed SVG)

**Files:**
- Modify: `package.json`
- Create: `src/components/TasteMap.tsx`
- Create: `src/components/TasteMap.css`
- Modify: `src/index.css`
- Modify: `src/App.tsx` (temporary — Task 10 replaces this)

- [ ] **Step 1: Install d3-force**

Run: `npm install d3-force && npm install -D @types/d3-force`

- [ ] **Step 2: Add palette tokens to `src/index.css`**

Replace the contents of `src/index.css`:

```css
:root {
  --color-bg-inner: #1b1035;
  --color-bg-outer: #05030d;
  --color-core: #ffb454;
  --color-candidate: #57d9d9;
  --color-text: #f4f1ff;
  --font-body: system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg-outer);
  color: var(--color-text);
  font-family: var(--font-body);
}
```

(The font is a system-stack placeholder — the style-prototype checkpoint at
the end of this plan is where a distinctive typeface gets picked.)

- [ ] **Step 3: Write `src/components/TasteMap.css`**

```css
.taste-map {
  width: 100%;
  height: 100%;
  display: block;
}

.taste-map-link {
  stroke: var(--color-text);
  stroke-opacity: 0.15;
  stroke-width: 1;
}

.taste-map-node-core {
  fill: var(--color-core);
  cursor: grab;
}

.taste-map-node-candidate {
  fill: var(--color-candidate);
  cursor: grab;
  transition: opacity 200ms ease;
}
```

- [ ] **Step 4: Write `src/components/TasteMap.tsx`**

```tsx
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceCenter,
} from "d3-force";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { Graph, GraphNode } from "../types";
import "./TasteMap.css";

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

const WIDTH = 900;
const HEIGHT = 640;
const MIN_RADIUS = 5;
const MAX_RADIUS = 30;
const MIN_OPACITY = 0.35;
const MAX_LINK_DISTANCE = 240;
const MIN_LINK_DISTANCE = 70;

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t));
}

function radiusFor(node: GraphNode): number {
  if (node.kind === "core") return MAX_RADIUS;
  return lerp(MIN_RADIUS, MAX_RADIUS, Math.sqrt(node.relevance));
}

function opacityFor(node: GraphNode): number {
  if (node.kind === "core") return 1;
  return lerp(MIN_OPACITY, 1, node.relevance);
}

interface TasteMapProps {
  graph: Graph;
  onSelectNode: (node: GraphNode | null) => void;
}

export default function TasteMap({ graph, onSelectNode }: TasteMapProps) {
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const draggingId = useRef<string | null>(null);

  useEffect(() => {
    const simNodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = graph.links.map((l) => ({ ...l }));

    const simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            const target = l.target as SimNode;
            return lerp(MAX_LINK_DISTANCE, MIN_LINK_DISTANCE, target.relevance);
          })
      )
      .force("charge", forceManyBody().strength(-120))
      .force("collide", forceCollide<SimNode>((d) => radiusFor(d) + 6))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2));

    simulation.on("tick", () => {
      setNodes([...simNodes]);
      setLinks([...simLinks]);
    });

    return () => {
      simulation.stop();
    };
  }, [graph]);

  function handlePointerDown(node: SimNode) {
    draggingId.current = node.id;
    node.fx = node.x;
    node.fy = node.y;
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!draggingId.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const node = nodes.find((n) => n.id === draggingId.current);
    if (!node) return;
    node.fx = e.clientX - rect.left;
    node.fy = e.clientY - rect.top;
  }

  function handlePointerUp() {
    if (!draggingId.current) return;
    const node = nodes.find((n) => n.id === draggingId.current);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    draggingId.current = null;
  }

  return (
    <svg
      className="taste-map"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <defs>
        <radialGradient id="taste-map-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="var(--color-bg-inner)" />
          <stop offset="100%" stopColor="var(--color-bg-outer)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#taste-map-bg)" />
      {links.map((l, i) => {
        const source = l.source as SimNode;
        const target = l.target as SimNode;
        return (
          <line
            key={i}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            className="taste-map-link"
          />
        );
      })}
      {nodes.map((node) => (
        <circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={radiusFor(node)}
          className={node.kind === "core" ? "taste-map-node-core" : "taste-map-node-candidate"}
          opacity={opacityFor(node)}
          onPointerDown={() => handlePointerDown(node)}
          onClick={() => onSelectNode(node)}
        >
          <title>{node.id}</title>
        </circle>
      ))}
    </svg>
  );
}
```

- [ ] **Step 5: Temporarily render `TasteMap` with sample data to verify visually**

Modify `src/App.tsx` (temporary — Task 10 replaces this with real fetched data):

```tsx
import { useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import { readSettings } from "./lib/settings";
import type { Settings, Graph } from "./types";

const sampleGraph: Graph = {
  nodes: [
    { id: "Radiohead", kind: "core", relevance: 1, listeners: 4000000 },
    {
      id: "Boards of Canada",
      kind: "candidate",
      relevance: 0.8,
      listeners: 300000,
      sourceCoreArtist: "Radiohead",
      match: 0.8,
    },
    {
      id: "Obscure Deep Cut",
      kind: "candidate",
      relevance: 0.4,
      listeners: 5000,
      sourceCoreArtist: "Radiohead",
      match: 0.4,
    },
  ],
  links: [
    { source: "Radiohead", target: "Boards of Canada" },
    { source: "Radiohead", target: "Obscure Deep Cut" },
  ],
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());

  if (!settings) {
    return <SettingsPanel onSaved={setSettings} />;
  }

  return <TasteMap graph={sampleGraph} onSelectNode={() => {}} />;
}
```

Run: `npm run dev`, open the browser (settings already saved from Task 8, so
this loads straight into the map).
Expected: one bright large circle (Radiohead) near center, two smaller
fainter circles connected to it by thin lines, all settling into place over
roughly a second. Dragging a node moves it and the sim reacts.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/index.css src/components/TasteMap.tsx src/components/TasteMap.css src/App.tsx
git commit -m "feat: add force-directed Taste Map component"
```

---

## Task 10: Wire real data pipeline into the Taste Map (checkpoint)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Rewrite `src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import { readSettings } from "./lib/settings";
import { fetchGraphData } from "./lib/fetchGraphData";
import { buildGraph } from "./lib/graph";
import type { Settings, Graph, GraphNode } from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; graph: Graph };

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    setLoadState({ status: "loading" });
    fetchGraphData(settings, "overall")
      .then((bundle) => {
        if (cancelled) return;
        setLoadState({ status: "ready", graph: buildGraph(bundle) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load your taste map.";
        setLoadState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [settings]);

  if (!settings) {
    return <SettingsPanel onSaved={setSettings} />;
  }

  if (loadState.status === "loading") {
    return <div className="status-message">Mapping {settings.username}'s taste...</div>;
  }

  if (loadState.status === "error") {
    return (
      <div className="status-message" role="alert">
        {loadState.message}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TasteMap graph={loadState.graph} onSelectNode={setSelected} />
      {selected && (
        <aside className="node-detail">
          <h2>{selected.id}</h2>
          <p>
            {selected.kind === "core"
              ? "Core artist"
              : `Because you listen to ${selected.sourceCoreArtist}`}
          </p>
          <p>{selected.listeners.toLocaleString()} listeners</p>
          <button onClick={() => setSelected(null)}>Close</button>
        </aside>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add layout styles to `src/index.css`**

Add to `src/index.css`:

```css
.status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-size: 1.25rem;
}

.app-shell {
  position: relative;
  height: 100vh;
}

.node-detail {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(10, 6, 24, 0.85);
  border: 1px solid var(--color-candidate);
  border-radius: 8px;
  padding: 1rem;
  min-width: 200px;
}
```

- [ ] **Step 3: Manually verify with a real Last.fm account**

Run: `npm run dev` (if not already running).
- If needed, clear localStorage and re-enter a real Last.fm API key + username in the settings panel.
- Expected: "Mapping `<username>`'s taste..." briefly, then the map renders — 5 core nodes and their similar-artist candidates settle into place.
- Click a node → detail panel appears with name, relevance context, listener count; Close button dismisses it.
- Drag a node → it follows the cursor and springs back into the simulation on release.
- Reload the page → loads faster (data served from the 24h cache, no refetch).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: wire Last.fm data pipeline into Taste Map"
```

---

## Checkpoint

This is the spec's style-prototype checkpoint (build order step 4). Show
the running app to the user before starting Deep Cuts or Drift — palette,
node sizing/falloff, load-in motion, and typography (still a system-font
placeholder) are all open for feedback here.
