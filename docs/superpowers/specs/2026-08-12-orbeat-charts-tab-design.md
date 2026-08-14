# Orbeat — Charts Tab (replaces Deep Cuts) Design Spec

Date: 2026-08-12

## Why

User feedback after using the tab-redesigned app: Deep Cuts felt useless
because it just re-shows the same similar-artist data the Map already
displays (as orbiting candidate planets), with none of the map's context.
Cutting `DeepCutsScreen`/`rankDeepCuts` entirely in favor of a **Charts**
tab: a ranked "your stats" page — top artists, top albums with real cover
art, top genres. This is something neither Map (spatial/exploratory) nor
Drift (temporal/comparative) does, and it's where the requested artist/
album photos land — specifically **album covers**, since Last.fm stopped
returning usable artist images years ago (its `artist.getinfo`/
`artist.getsimilar` image fields have returned empty strings network-wide
since ~2019, a Last.fm-side licensing change, not something this app can
work around without a second image provider). Album art via
`user.gettopalbums` is reliable and already partially wired up (`TopAlbum`
today only fetches the #1 album for `ProfileCard`) — this spec extends
that to a full ranked list with covers.

## What gets removed

- `src/components/DeepCutsScreen.tsx` (deleted)
- `src/lib/deepCuts.ts` + `src/lib/deepCuts.test.ts` (deleted — no longer
  used anywhere; `rankDeepCuts` was Deep-Cuts-only logic)
- The `deepCuts` memo and its wiring in `src/App.tsx`
- The "Deep Cuts" tab label in `ViewToggle` (relabeled "Charts")

## Data changes

### `TopAlbum` gains cover art, and the fetch widens from 1 to N

`src/lib/lastfm.ts`'s `getTopAlbums` already takes a `limit` param
(currently called with `1`). Extend `TopAlbum` in `src/types.ts`:

```ts
export interface TopAlbum {
  name: string;
  artist: string;
  image: string | null;
}
```

`getTopAlbums`'s mapping extracts the largest image the same way
`getUserInfo` already does for the user avatar (`images.find(i => i.size
=== "extralarge")?.["#text"]`, falling back to `null` for an empty/missing
URL — same graceful-degradation rule already established, `ProfileCard`'s
avatar placeholder is the existing precedent for "no image available").

### `fetchProfileData` fetches more albums

Change the call site in `src/lib/fetchProfileData.ts` from
`getTopAlbums(apiKey, username, 1)` to a larger limit (10) and store the
full list. `ProfileDataBundle` changes:

```ts
export interface ProfileDataBundle {
  profile: UserProfile;
  topAlbums: TopAlbum[]; // renamed from topAlbum, now a list
}
```

`App.tsx`'s existing single "Top Album" stat on `ProfileCard` derives from
`topAlbums[0] ?? null` instead of a separately-fetched single album — same
cache key (`cacheKey("topAlbums", username)`), no new network call beyond
the limit increase. `ProfileCard`'s own prop stays `topAlbumName: string |
null` (unchanged, just sourced differently in `App.tsx`).

### Top artists and top genres — no new fetching

- Top artists: the existing `core: TopArtist[]` already on the fetched
  graph bundle (5 artists, already ranked) — same data `TasteMap`'s core
  nodes use.
- Top genres: the existing `topGenres()` function in
  `src/lib/profileStats.ts` (already computed and used for `ProfileCard`'s
  small genre-bar visualizer) — reused as-is, just rendered larger/fuller
  on this tab instead of only the sidebar's compact version.

No changes to `src/lib/graph.ts`, `src/lib/drift.ts`, `TasteMap`, or
`DriftChart` — this is additive/substitutive, isolated to the
replaced tab.

## Screen layout

New component `src/components/ChartsScreen.tsx`, replacing
`DeepCutsScreen.tsx` in the tab-bar wiring. Three stacked sections, same
full-tab framing (`.map-area`-style container, per the tab-redesign
precedent) as the other two tabs:

1. **Top Artists** — ranked list (not a grid — no imagery to show per
   artist, a grid would just be empty cards; a clean numbered list reads
   better for text-only ranked data). Each row: rank number, artist name,
   playcount. Reuses the existing `--font-hud`/rank-badge visual language
   already established for Deep Cuts' rank badges (Task from the prior
   plan) — same badge treatment, different list.
2. **Top Albums** — a card grid (this one DOES have imagery): cover art
   image (or a placeholder tile matching `ProfileCard`'s existing
   avatar-placeholder pattern when `image` is `null`), album name, artist
   name, rank badge. This is the section carrying the photo request.
3. **Top Genres** — reuse `topGenres()`'s output as a full-width horizontal
   bar chart (one bar per genre, length by tag count, reusing the existing
   `--accent-cyan`/`--accent-pink`/`--accent-yellow`/`--accent-coral`
   cycling already used in `ProfileCard`'s compact genre bars) — same data,
   same color assignment, just given real width/height to breathe instead
   of the sidebar's cramped version.

Empty states per section (sparse account, e.g. no albums scrobbled): same
"—" / short-message convention already used elsewhere in this app
(`ProfileCard`'s `??  "—"` fields, `DriftChart`'s empty-state message) —
never a blank gap with no explanation.

## Out of scope

- A second image provider (Spotify/MusicBrainz/Cover Art Archive) for
  artist photos — not pursued; the spec explicitly accepts album art as
  the photo answer given Last.fm's own limitation, disclosed above rather
  than silently working around it.
- Click-through from a chart row/card to Map or Drift (consistent with
  every other cross-tab-click decision already made in this app).
- Any change to how many top artists are fetched (still 5, matching the
  graph's existing core-artist count) — a longer artist chart would need
  a second `getTopArtists` call with a larger limit, deliberately not
  pursued here to avoid an extra network call for a nice-to-have; 5 is
  enough for a "top artists" chart section.
