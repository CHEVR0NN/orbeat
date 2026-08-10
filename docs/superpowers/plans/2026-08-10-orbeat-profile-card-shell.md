# Orbeat Profile Card Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "bare map fills the screen" layout with a
proper shell: a license-card-styled `ProfileCard` sidebar (avatar,
username, top artist/album/genre, total scrobbles, legend, Refresh/Change
Account controls) + the existing `TasteMap` filling the remaining space.

**Architecture:** Two new Last.fm calls (`user.getInfo`, `user.getTopAlbums`)
follow the existing `src/lib` pattern exactly — pure fetch wrapper in
`lastfm.ts`, cached orchestration in a dedicated `fetchProfileData.ts`
mirroring `fetchGraphData.ts`. A shared `getCachedOrFetch` helper (with a
new `forceRefresh` option) is extracted from `fetchGraphData.ts` into
`cache.ts` so both fetch modules use one implementation. "Top genre" is
derived from tag data the app already fetches — no new API call. Profile
data is fetched independently from graph data and never blocks the map on
failure.

**Tech Stack:** No new dependencies. Same stack as Phase 1 (Vite, React,
TypeScript, Vitest, plain CSS with the existing Retro Cosmic Pop tokens).

---

## Task 1: Shared cache helper with `forceRefresh`

**Files:**
- Modify: `src/lib/cache.ts`
- Modify: `src/lib/cache.test.ts`
- Modify: `src/lib/fetchGraphData.ts`
- Modify: `src/lib/fetchGraphData.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/cache.test.ts` (append inside the existing `describe("cache", ...)` block, after the last test, alongside the existing `readCache`/`writeCache`/`isStale` tests — don't modify those):

```ts
  it("getCachedOrFetch returns cached data without calling fetchFn when fresh", async () => {
    writeCache("k", "cached-value");
    const fetchFn = vi.fn(async () => "fresh-value");
    const result = await getCachedOrFetch("k", fetchFn);
    expect(result).toEqual({ data: "cached-value", fromCache: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("getCachedOrFetch calls fetchFn and writes cache when missing", async () => {
    const fetchFn = vi.fn(async () => "fresh-value");
    const result = await getCachedOrFetch("k", fetchFn);
    expect(result).toEqual({ data: "fresh-value", fromCache: false });
    expect(readCache<string>("k")?.data).toBe("fresh-value");
  });

  it("getCachedOrFetch with forceRefresh bypasses a fresh cache entry", async () => {
    writeCache("k", "cached-value");
    const fetchFn = vi.fn(async () => "fresh-value");
    const result = await getCachedOrFetch("k", fetchFn, true);
    expect(result).toEqual({ data: "fresh-value", fromCache: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(readCache<string>("k")?.data).toBe("fresh-value");
  });
```

Update the import at the top of `src/lib/cache.test.ts` to also pull in
`getCachedOrFetch` (it doesn't exist yet — that's what makes this fail):

```ts
import { cacheKey, readCache, writeCache, isStale, getCachedOrFetch } from "./cache";
```

Add to `src/lib/fetchGraphData.test.ts` (append after the existing 2 tests, inside `describe("fetchGraphData", ...)`):

```ts
  it("forceRefresh bypasses the cache and refetches even when fresh data exists", async () => {
    const fetchers = makeFetchers();
    const settings = { apiKey: "key", username: "kai" };
    await fetchGraphData(settings, "overall", fetchers, 0);
    await fetchGraphData(settings, "overall", fetchers, 0, true);

    expect(fetchers.getTopArtists).toHaveBeenCalledTimes(2);
    expect(fetchers.getTopTags).toHaveBeenCalledTimes(4);
  });
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npm test`
Expected: FAIL — `getCachedOrFetch` is not exported from `./cache`, and
`fetchGraphData` doesn't accept a 5th `forceRefresh` argument yet (the new
test will still run since JS ignores extra args, but it will fail the
`toHaveBeenCalledTimes` assertions since nothing bypasses the cache yet).

- [ ] **Step 3: Move `getCachedOrFetch` into `src/lib/cache.ts`**

Add to the end of `src/lib/cache.ts` (keep everything already in the file
— `cacheKey`, `readCache`, `writeCache`, `isStale` — unchanged):

```ts
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  forceRefresh = false
): Promise<{ data: T; fromCache: boolean }> {
  const cached = readCache<T>(key);
  if (!forceRefresh && !isStale(cached)) return { data: cached!.data, fromCache: true };
  const data = await fetchFn();
  writeCache(key, data);
  return { data, fromCache: false };
}
```

- [ ] **Step 4: Update `src/lib/fetchGraphData.ts` to use the shared helper and add `forceRefresh`**

Replace the entire file:

```ts
import { getTopArtists, getTopTags, getSimilar, getInfo } from "./lastfm";
import { cacheKey, getCachedOrFetch } from "./cache";
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

export async function fetchGraphData(
  settings: Settings,
  period: Period,
  fetchers: Fetchers = DEFAULT_FETCHERS,
  requestDelayMs: number = REQUEST_DELAY_MS,
  forceRefresh = false
): Promise<GraphDataBundle> {
  const { data: core } = await getCachedOrFetch(
    cacheKey("topArtists", settings.username, period),
    () => fetchers.getTopArtists(settings.apiKey, settings.username, period),
    forceRefresh
  );

  const tagsByArtist: GraphDataBundle["tagsByArtist"] = {};
  const similarByArtist: GraphDataBundle["similarByArtist"] = {};

  for (const artist of core) {
    const tagsResult = await getCachedOrFetch(
      cacheKey("topTags", artist.name),
      () => fetchers.getTopTags(settings.apiKey, artist.name),
      forceRefresh
    );
    tagsByArtist[artist.name] = tagsResult.data;
    if (!tagsResult.fromCache) await delay(requestDelayMs);

    const similarResult = await getCachedOrFetch(
      cacheKey("similar", artist.name),
      () => fetchers.getSimilar(settings.apiKey, artist.name, 10),
      forceRefresh
    );
    similarByArtist[artist.name] = similarResult.data;
    if (!similarResult.fromCache) await delay(requestDelayMs);
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
    const { data: info, fromCache } = await getCachedOrFetch(
      cacheKey("info", name),
      () => fetchers.getInfo(settings.apiKey, name),
      forceRefresh
    );
    if (info) infoByArtist[name] = info;
    if (!fromCache) await delay(requestDelayMs);
  }

  return { core, tagsByArtist, similarByArtist, infoByArtist };
}
```

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `npm test`
Expected: PASS — all tests pass (23 existing + 4 new = 27).

- [ ] **Step 6: Commit**

```bash
git add src/lib/cache.ts src/lib/cache.test.ts src/lib/fetchGraphData.ts src/lib/fetchGraphData.test.ts
git commit -m "refactor: extract shared getCachedOrFetch helper with forceRefresh support"
```

---

## Task 2: Last.fm `user.getInfo` and `user.getTopAlbums`

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/lastfm.ts`
- Modify: `src/lib/lastfm.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/lastfm.test.ts` (append inside `describe("lastfm", ...)`,
after the existing 6 tests):

```ts
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

  it("getTopAlbums maps album name and artist name", async () => {
    mockFetchOnce({
      topalbums: { album: [{ name: "OK Computer", artist: { name: "Radiohead" } }] },
    });
    const result = await getTopAlbums("key", "kai", 1);
    expect(result).toEqual([{ name: "OK Computer", artist: "Radiohead" }]);
  });

  it("getTopAlbums returns an empty array when the user has no scrobbled albums", async () => {
    mockFetchOnce({ topalbums: { album: [] } });
    const result = await getTopAlbums("key", "kai", 1);
    expect(result).toEqual([]);
  });
```

Update the import line at the top of `src/lib/lastfm.test.ts`:

```ts
import { getTopArtists, getTopTags, getSimilar, getInfo, getUserInfo, getTopAlbums, LastfmError } from "./lastfm";
```

- [ ] **Step 2: Run the tests, confirm they fail**

Run: `npm test`
Expected: FAIL — `getUserInfo` and `getTopAlbums` are not exported from
`./lastfm`.

- [ ] **Step 3: Add `UserProfile` and `TopAlbum` to `src/types.ts`**

Append to `src/types.ts` (don't remove anything already there):

```ts
export interface UserProfile {
  name: string;
  image: string | null;
  playcount: number;
}

export interface TopAlbum {
  name: string;
  artist: string;
}
```

- [ ] **Step 4: Add the two functions to `src/lib/lastfm.ts`**

Update the top-of-file import to include the new types:

```ts
import type {
  Period,
  TopArtist,
  ArtistTag,
  SimilarArtist,
  ArtistInfo,
  UserProfile,
  TopAlbum,
} from "../types";
```

Append to the end of `src/lib/lastfm.ts` (after the existing `getInfo`):

```ts
export async function getUserInfo(apiKey: string, username: string): Promise<UserProfile> {
  const json = await call({ method: "user.getinfo", user: username }, apiKey);
  const user = json.user ?? {};
  const images = user.image ?? [];
  const largest = images.length > 0 ? images[images.length - 1]?.["#text"] : "";
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
```

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `npm test`
Expected: PASS — all tests pass (27 existing + 4 new = 31).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/lastfm.ts src/lib/lastfm.test.ts
git commit -m "feat: add getUserInfo and getTopAlbums to the Last.fm wrapper"
```

---

## Task 3: Top genre derivation (pure logic)

**Files:**
- Create: `src/lib/profileStats.ts`
- Test: `src/lib/profileStats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/profileStats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { topGenre } from "./profileStats";

describe("topGenre", () => {
  it("returns null for empty input", () => {
    expect(topGenre({})).toBeNull();
  });

  it("returns the only tag for a single artist", () => {
    expect(topGenre({ Radiohead: [{ name: "alternative", count: 100 }] })).toBe("alternative");
  });

  it("aggregates tag counts across multiple artists", () => {
    const tagsByArtist = {
      Radiohead: [
        { name: "alternative", count: 50 },
        { name: "electronic", count: 10 },
      ],
      "Aphex Twin": [
        { name: "electronic", count: 60 },
        { name: "idm", count: 20 },
      ],
    };
    // electronic: 10 + 60 = 70, alternative: 50, idm: 20 -> electronic wins
    expect(topGenre(tagsByArtist)).toBe("electronic");
  });

  it("keeps the first-seen tag when totals tie", () => {
    const tagsByArtist = {
      Radiohead: [{ name: "alternative", count: 50 }],
      "Aphex Twin": [{ name: "electronic", count: 50 }],
    };
    expect(topGenre(tagsByArtist)).toBe("alternative");
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./profileStats`.

- [ ] **Step 3: Write `src/lib/profileStats.ts`**

```ts
import type { ArtistTag } from "../types";

export function topGenre(tagsByArtist: Record<string, ArtistTag[]>): string | null {
  const counts = new Map<string, number>();
  for (const tags of Object.values(tagsByArtist)) {
    for (const tag of tags) {
      counts.set(tag.name, (counts.get(tag.name) ?? 0) + tag.count);
    }
  }

  let best: string | null = null;
  let bestCount = -1;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS — all tests pass (31 existing + 4 new = 35).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profileStats.ts src/lib/profileStats.test.ts
git commit -m "feat: add topGenre derivation from already-fetched tag data"
```

---

## Task 4: Profile data fetch orchestration

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/fetchProfileData.ts`
- Test: `src/lib/fetchProfileData.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/fetchProfileData.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./fetchProfileData`.

- [ ] **Step 3: Add `ProfileDataBundle` to `src/types.ts`**

Append to `src/types.ts`:

```ts
export interface ProfileDataBundle {
  profile: UserProfile;
  topAlbum: TopAlbum | null;
}
```

- [ ] **Step 4: Write `src/lib/fetchProfileData.ts`**

```ts
import { getUserInfo, getTopAlbums } from "./lastfm";
import { cacheKey, getCachedOrFetch } from "./cache";
import type { Settings, ProfileDataBundle } from "../types";

interface ProfileFetchers {
  getUserInfo: typeof getUserInfo;
  getTopAlbums: typeof getTopAlbums;
}

const DEFAULT_FETCHERS: ProfileFetchers = { getUserInfo, getTopAlbums };

export async function fetchProfileData(
  settings: Settings,
  fetchers: ProfileFetchers = DEFAULT_FETCHERS,
  forceRefresh = false
): Promise<ProfileDataBundle> {
  const { data: profile } = await getCachedOrFetch(
    cacheKey("userProfile", settings.username),
    () => fetchers.getUserInfo(settings.apiKey, settings.username),
    forceRefresh
  );

  const { data: albums } = await getCachedOrFetch(
    cacheKey("topAlbums", settings.username),
    () => fetchers.getTopAlbums(settings.apiKey, settings.username, 1),
    forceRefresh
  );

  return { profile, topAlbum: albums[0] ?? null };
}
```

- [ ] **Step 5: Run the test, confirm it passes**

Run: `npm test`
Expected: PASS — all tests pass (35 existing + 4 new = 39).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/fetchProfileData.ts src/lib/fetchProfileData.test.ts
git commit -m "feat: add cached profile data fetch (user info + top album)"
```

---

## Task 5: ProfileCard component + card/layout styles

**Files:**
- Create: `src/components/ProfileCard.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add card tokens and layout/card CSS to `src/index.css`**

Add `--card-bg` and `--card-text` inside the existing `:root` block (append
after `--font-body`, don't touch anything else in `:root`):

```css
  --card-bg: #f3c9e8;
  --card-text: #241a3d;
```

Append to the end of `src/index.css`:

```css
.app-shell-layout {
  display: flex;
  height: 100vh;
}

.map-area {
  position: relative;
  flex: 1;
  min-width: 0;
}

.profile-card {
  width: 300px;
  flex-shrink: 0;
  background: var(--card-bg);
  border-right: 2px solid var(--accent-cyan);
  box-shadow: 0 0 24px rgba(35, 229, 216, 0.25);
  color: var(--card-text);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
}

.profile-card-identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.profile-card-avatar {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  object-fit: cover;
  border: 2px solid var(--accent-cyan);
}

.profile-card-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-space-dark);
  font-size: 1.5rem;
}

.profile-card-username {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--card-text);
}

.profile-card-stats {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border-top: 1px dashed var(--card-text);
  border-bottom: 1px dashed var(--card-text);
  padding: 1rem 0;
}

.profile-card-stat {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-family: var(--font-hud);
  font-size: 0.75rem;
}

.profile-card-stat dt {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.75;
}

.profile-card-stat dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}

.profile-card-legend {
  display: flex;
  gap: 1rem;
  font-family: var(--font-hud);
  font-size: 0.7rem;
  text-transform: uppercase;
}

.profile-card-legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.profile-card-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.profile-card-legend-dot-core {
  background: var(--accent-yellow);
}

.profile-card-legend-dot-candidate {
  background: var(--accent-pink);
}

.profile-card-controls {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: auto;
}

.profile-card-controls button {
  background: transparent;
  border: 1px solid var(--card-text);
  border-radius: 6px;
  color: var(--card-text);
  cursor: pointer;
  font-family: var(--font-hud);
  font-size: 0.8rem;
  padding: 0.5rem;
  transition: background 150ms ease, color 150ms ease;
}

.profile-card-controls button:hover:not(:disabled) {
  background: var(--card-text);
  color: var(--card-bg);
}

.profile-card-controls button:disabled {
  opacity: 0.6;
  cursor: default;
}
```

- [ ] **Step 2: Write `src/components/ProfileCard.tsx`**

```tsx
interface ProfileCardProps {
  username: string;
  avatarUrl: string | null;
  topArtistName: string | null;
  topAlbumName: string | null;
  totalScrobbles: number | null;
  topGenreName: string | null;
  onRefresh: () => void;
  onChangeAccount: () => void;
  refreshing: boolean;
}

export default function ProfileCard({
  username,
  avatarUrl,
  topArtistName,
  topAlbumName,
  totalScrobbles,
  topGenreName,
  onRefresh,
  onChangeAccount,
  refreshing,
}: ProfileCardProps) {
  return (
    <aside className="profile-card">
      <div className="profile-card-identity">
        {avatarUrl ? (
          <img className="profile-card-avatar" src={avatarUrl} alt="" />
        ) : (
          <div className="profile-card-avatar profile-card-avatar-placeholder" aria-hidden="true">
            👽
          </div>
        )}
        <span className="profile-card-username">{username}</span>
      </div>

      <dl className="profile-card-stats">
        <div className="profile-card-stat">
          <dt>Top Artist</dt>
          <dd>{topArtistName ?? "—"}</dd>
        </div>
        <div className="profile-card-stat">
          <dt>Top Album</dt>
          <dd>{topAlbumName ?? "—"}</dd>
        </div>
        <div className="profile-card-stat">
          <dt>Total Scrobbles</dt>
          <dd>{totalScrobbles !== null ? totalScrobbles.toLocaleString() : "—"}</dd>
        </div>
        <div className="profile-card-stat">
          <dt>Top Genre</dt>
          <dd>{topGenreName ?? "—"}</dd>
        </div>
      </dl>

      <div className="profile-card-legend">
        <span className="profile-card-legend-item">
          <span className="profile-card-legend-dot profile-card-legend-dot-core" /> core
        </span>
        <span className="profile-card-legend-item">
          <span className="profile-card-legend-dot profile-card-legend-dot-candidate" /> candidate
        </span>
      </div>

      <div className="profile-card-controls">
        <button type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
        <button type="button" onClick={onChangeAccount}>
          Change Account
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

`src/App.tsx` is not touched by this task (real wiring is Task 6) — to
view `ProfileCard` visually, temporarily replace the body of the `App`
function in `src/App.tsx` with a harness rendering it with sample data,
ignoring the settings gate entirely:

```tsx
export default function App() {
  return (
    <div className="app-shell-layout">
      <ProfileCard
        username="testuser"
        avatarUrl={null}
        topArtistName="Radiohead"
        topAlbumName="OK Computer"
        totalScrobbles={48213}
        topGenreName="alternative"
        onRefresh={() => {}}
        onChangeAccount={() => {}}
        refreshing={false}
      />
      <div className="map-area" style={{ background: "#000" }} />
    </div>
  );
}
```

(You'll need a temporary `import ProfileCard from "./components/ProfileCard";`
at the top too.) Run `npm run dev`, confirm: pastel pink/lavender card
docked left with a cyan border/glow, alien-emoji placeholder avatar next
to "testuser", four dashed-divider stat rows showing the sample values,
core/candidate legend dots, and Refresh/Change Account buttons.

**After verifying, revert `src/App.tsx` completely back to its current
state** (`git checkout -- src/App.tsx` or undo your edits manually) —
this task's commit must not include any `App.tsx` changes.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProfileCard.tsx src/index.css
git commit -m "feat: add ProfileCard component and license-card layout styles"
```

---

## Task 6: Wire ProfileCard + profile data into App (checkpoint)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Remove the now-unused `.app-shell` rule from `src/index.css`**

Delete this block (the layout it served is being replaced by
`.app-shell-layout`/`.map-area` from Task 5):

```css
.app-shell {
  position: relative;
  height: 100vh;
}
```

- [ ] **Step 2: Rewrite `src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import SettingsPanel from "./components/SettingsPanel";
import TasteMap from "./components/TasteMap";
import ProfileCard from "./components/ProfileCard";
import { readSettings, clearSettings } from "./lib/settings";
import { fetchGraphData } from "./lib/fetchGraphData";
import { fetchProfileData } from "./lib/fetchProfileData";
import { buildGraph } from "./lib/graph";
import { topGenre } from "./lib/profileStats";
import type { Settings, Graph, GraphNode, UserProfile, TopAlbum } from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      graph: Graph;
      topArtistName: string | null;
      topGenreName: string | null;
    };

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(() => readSettings());
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [topAlbum, setTopAlbum] = useState<TopAlbum | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    setLoadState({ status: "loading" });

    fetchGraphData(settings, "overall")
      .then((bundle) => {
        if (cancelled) return;
        setLoadState({
          status: "ready",
          graph: buildGraph(bundle),
          topArtistName: bundle.core[0]?.name ?? null,
          topGenreName: topGenre(bundle.tagsByArtist),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load your taste map.";
        setLoadState({ status: "error", message });
      });

    fetchProfileData(settings)
      .then((bundle) => {
        if (cancelled) return;
        setProfile(bundle.profile);
        setTopAlbum(bundle.topAlbum);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setTopAlbum(null);
      });

    return () => {
      cancelled = true;
    };
  }, [settings]);

  async function handleRefresh() {
    if (!settings) return;
    setRefreshing(true);
    try {
      const [bundle, profileBundle] = await Promise.all([
        fetchGraphData(settings, "overall", undefined, undefined, true),
        fetchProfileData(settings, undefined, true).catch(() => null),
      ]);
      setLoadState({
        status: "ready",
        graph: buildGraph(bundle),
        topArtistName: bundle.core[0]?.name ?? null,
        topGenreName: topGenre(bundle.tagsByArtist),
      });
      if (profileBundle) {
        setProfile(profileBundle.profile);
        setTopAlbum(profileBundle.topAlbum);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to refresh your taste map.";
      setLoadState({ status: "error", message });
    } finally {
      setRefreshing(false);
    }
  }

  function handleChangeAccount() {
    clearSettings();
    setSettings(null);
    setProfile(null);
    setTopAlbum(null);
  }

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
    <div className="app-shell-layout">
      <ProfileCard
        username={profile?.name || settings.username}
        avatarUrl={profile?.image ?? null}
        topArtistName={loadState.topArtistName}
        topAlbumName={topAlbum?.name ?? null}
        totalScrobbles={profile?.playcount ?? null}
        topGenreName={loadState.topGenreName}
        onRefresh={handleRefresh}
        onChangeAccount={handleChangeAccount}
        refreshing={refreshing}
      />
      <div className="map-area">
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
            {selected.match !== undefined && <p>{Math.round(selected.match * 100)}% similar</p>}
            <button onClick={() => setSelected(null)}>Close</button>
          </aside>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in a real browser**

Run: `npm run dev`.

Since there's no real Last.fm account in a dev/CI environment, verify what
you can genuinely, and be explicit about which is which:

- **Genuinely testable live:** seed `localStorage.orbeat_settings` with a
  garbage-but-well-shaped key/username, reload. Confirm: loading message
  shows, then (since the key is invalid) the full-screen error state shows
  — same as Phase 1's error path, now unaffected by the profile-card
  changes. This also exercises `fetchProfileData`'s independent failure
  path — confirm via a quick code read that a `LastfmError` from
  `fetchProfileData` does NOT trigger the full-screen error state (only
  `fetchGraphData` failures do), per `handleChangeAccount`/`useEffect`
  above.
- **Code read-through** (no real account available): confirm
  `ProfileCard`'s props line up with what `App.tsx` passes — `profile?.name`,
  `profile?.image`, `profile?.playcount`, `topAlbum?.name`,
  `loadState.topArtistName`, `loadState.topGenreName` all match the
  component's prop types exactly (`npx tsc -b` passing confirms this
  mechanically, but read it too).
- Confirm `.app-shell` no longer appears anywhere in `src/index.css` or
  any `className` in the codebase (grep for it) — dead rule fully removed,
  not just its className now unused.

- [ ] **Step 4: Run the full test suite and build**

Run: `npm test`
Expected: PASS — 39/39 tests (no new tests in this task; App.tsx isn't
unit tested, consistent with the rest of the project).

Run: `npm run build`
Expected: succeeds, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: wire ProfileCard and profile data into App shell"
```

---

## Checkpoint

This is the shell redesign the user asked for before resuming Deep Cuts.
Show the running app — left sidebar profile card, map on the right —
before picking Deep Cuts back up. Deep Cuts' view toggle (from
`docs/superpowers/specs/2026-08-10-orbeat-deep-cuts-design.md`) will need
a small adjustment when that plan resumes: it currently says the toggle
goes into "the existing header," which no longer exists in that form —
it should slot into the `ProfileCard` sidebar or sit above the map area
instead. Update that spec's "View toggle" section before writing Deep
Cuts' implementation plan.
