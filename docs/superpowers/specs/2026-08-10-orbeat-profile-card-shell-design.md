# Orbeat — Profile Card Shell Design Spec

Date: 2026-08-10

## Summary

Replaces the current "map fills the whole screen" layout with a proper
shell: a license-card-styled profile sidebar (left) + the Taste Map filling
the remaining space (right). This is the holistic app-shell pass agreed on
before resuming feature work (Deep Cuts, Drift) — those later plans plug
into this shell rather than each inventing their own header/chrome.

Visual direction: "UFO Driver's License" — a pastel pink/lavender card
face with a neon-cyan border/glow against the existing dark cosmic
background, dark navy text on the card for contrast, monospace
license-style labels. Matches the reference image the user provided.

## Layout

```
┌──────────────┬─────────────────────────────┐
│              │                              │
│  ProfileCard │         TasteMap             │
│  (sidebar,   │      (fills remaining        │
│   fixed      │       space)                 │
│   width)     │                              │
│              │   [node-detail overlay,      │
│              │    unchanged from Phase 1]   │
└──────────────┴─────────────────────────────┘
```

`App.tsx`'s `ready` state renders a flex row: `ProfileCard` (fixed-width
sidebar) + a map area containing the existing `TasteMap` and node-detail
`<aside>` (unchanged, still an overlay on top of the map area).

## ProfileCard content

Top to bottom:

1. **Avatar + username**, side by side in one row (not stacked).
2. Divider.
3. Four stat rows, license-field style (`LABEL .... value`):
   - `TOP ARTIST` — the user's #1 core artist (`bundle.core[0].name`,
     already fetched, free — no new API call)
   - `TOP ALBUM` — new data, see below
   - `TOTAL SCROBBLES` — new data, see below
   - `TOP GENRE` — derived from tag data already fetched for the graph
     (see "Top genre derivation" below), free — no new API call
4. Divider.
5. **Legend** — small color-key dots for core vs. candidate nodes (moved
   here from the earlier plain-header proposal).
6. **Controls** — Refresh and Change Account buttons.

Missing/unavailable fields (e.g. no top album data) render as `—` rather
than blocking the card or erroring.

## New data needed

### `user.getInfo` (new Last.fm endpoint — not the existing `artist.getInfo`)

New function in `src/lib/lastfm.ts`:

```ts
export interface UserProfile {
  name: string;
  image: string | null;
  playcount: number;
}

export async function getUserInfo(apiKey: string, username: string): Promise<UserProfile>
```

Calls `user.getinfo`, extracts the largest available avatar URL from the
`image` array (Last.fm returns multiple sizes; take the last/largest).
Falls back to `image: null` if Last.fm returns an empty URL (accounts
without a custom avatar) — `ProfileCard` shows a placeholder graphic in
that case. `playcount` here is the user's **total scrobble count**, not an
artist's — this single call covers both the avatar and the "total
scrobbles" stat.

### `user.getTopAlbums`

New function in `src/lib/lastfm.ts`:

```ts
export interface TopAlbum {
  name: string;
  artist: string;
}

export async function getTopAlbums(apiKey: string, username: string, limit = 1): Promise<TopAlbum[]>
```

Called with `limit = 1` to fetch just the top album. Returns `[]` if the
user has no scrobbled albums (sparse account) — caller treats this as "no
top album," not an error.

### Top genre derivation (no new API call)

New pure function, `src/lib/profileStats.ts`:

```ts
export function topGenre(tagsByArtist: Record<string, ArtistTag[]>): string | null
```

Aggregates tag counts across every core artist's tag list (already fetched
into `GraphDataBundle.tagsByArtist` by the existing pipeline) and returns
the name of the tag with the highest total count. Returns `null` for empty
input. This reuses data the app already fetches for the map — no new
Last.fm calls.

## Fetch orchestration changes

### Shared cache helper extracted

`getCachedOrFetch` currently lives privately inside `fetchGraphData.ts`.
Move it to `src/lib/cache.ts` as an exported utility, so both the existing
graph-data fetch and the new profile-data fetch share one implementation:

```ts
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  forceRefresh = false
): Promise<{ data: T; fromCache: boolean }>
```

`forceRefresh: true` skips the staleness check and always refetches +
overwrites the cache entry — this is what powers the new Refresh button.

### `fetchGraphData` gains `forceRefresh`

```ts
export async function fetchGraphData(
  settings: Settings,
  period: Period,
  fetchers: Fetchers = DEFAULT_FETCHERS,
  requestDelayMs: number = REQUEST_DELAY_MS,
  forceRefresh = false
): Promise<GraphDataBundle>
```

Threaded through to every internal `getCachedOrFetch` call.

### New `fetchProfileData`

New module `src/lib/fetchProfileData.ts`, same shape as `fetchGraphData`:

```ts
export interface ProfileDataBundle {
  profile: UserProfile;
  topAlbum: TopAlbum | null;
}

export async function fetchProfileData(
  settings: Settings,
  fetchers = { getUserInfo, getTopAlbums },
  forceRefresh = false
): Promise<ProfileDataBundle>
```

Two cached calls (`user.getinfo`, `user.gettopalbums`), no fan-out, no
delay loop needed (only 2 calls total).

### `App.tsx` wiring

The load effect now fires **both** `fetchGraphData` and `fetchProfileData`
for a given `settings` value. They run independently (not chained) since
they're unrelated data — a small amount of parallel Last.fm traffic on
load is an acceptable tradeoff for two extra calls.

**Error handling — profile data is supplementary, not blocking:** if
`fetchProfileData` fails, it must NOT put the app into the existing
`error` state (which would hide the map). It's caught separately; on
failure, `ProfileCard` renders with a fallback (username only, avatar
placeholder, stat rows as `—`). Only `fetchGraphData` failing produces the
existing full-screen error state, unchanged from Phase 1.

`topGenre(bundle.tagsByArtist)` is computed once when `fetchGraphData`
resolves (before/alongside `buildGraph`), and its result is kept in state
alongside the built `Graph` — `buildGraph`'s output alone doesn't retain
tag data, so this must be computed at the point the raw bundle is still in
scope.

**Refresh button**: re-runs both fetches with `forceRefresh: true`.

**Change Account button**: calls the existing (currently unused)
`clearSettings()`, resets `settings` state to `null`, returning to
`SettingsPanel`.

## Visual design tokens

New CSS custom properties added to `src/index.css` (alongside the existing
Retro Cosmic Pop palette, not replacing it):

```css
--card-bg: #f3c9e8;       /* pastel pink/lavender card face */
--card-text: #241a3d;     /* dark navy text for contrast on the card */
```

`ProfileCard`'s border/glow reuses the existing `--accent-cyan` token, and
its label typography reuses `--font-hud` — no new fonts.

## Testing

- `topGenre` — Vitest unit tests: empty input → `null`, single artist,
  aggregation across multiple artists, deterministic tie-break behavior
  (documented in the test, not left ambiguous).
- `getUserInfo` / `getTopAlbums` — Vitest tests following the existing
  `lastfm.test.ts` pattern (mocked `fetch`): correct field mapping, empty
  `image` array → `null`, empty `topalbums` → `[]`.
- `fetchProfileData` — Vitest tests following the existing
  `fetchGraphData.test.ts` pattern (injected fake fetchers): normal fetch,
  cache reuse on second call, `forceRefresh` bypasses cache.
- `getCachedOrFetch`'s new `forceRefresh` parameter — covered via the
  `fetchGraphData`/`fetchProfileData` tests above; no separate cache.ts
  test needed beyond what's already there plus one new case.
- No component tests for `ProfileCard` or the new layout — consistent with
  the project's existing "no component/UI test framework for v1" decision.
  Manual browser verification instead (real Playwright checks, per this
  project's established practice — not just build/type-check).

## Out of scope

- Deep Cuts and Drift lenses — separate future plans, will add a view
  toggle into this shell once built (not built here).
- Editing/changing which stats appear on the card — fixed set for now.
