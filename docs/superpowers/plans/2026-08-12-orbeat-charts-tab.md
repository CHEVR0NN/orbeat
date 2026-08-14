# Orbeat Charts Tab — Implementation Plan

**Goal:** Implement `docs/superpowers/specs/2026-08-12-orbeat-charts-tab-design.md`
— delete the Deep Cuts tab/logic and replace it with a Charts tab (ranked
top artists, top albums with real cover art, top genres).

Read the full spec first, then the current state of every file below
before editing (this repo has had three prior builds touch these areas —
Deep Cuts, Drift, and the tab redesign — read current code, not memory of
older plans):
- `src/lib/lastfm.ts` (`getTopAlbums`, and `getUserInfo`'s existing
  largest-image extraction pattern to mirror)
- `src/lib/fetchProfileData.ts` + its test file
- `src/types.ts` (`TopAlbum`, `ProfileDataBundle`)
- `src/App.tsx` (current `deepCuts` memo, `lens` state/type, `ViewToggle`/
  `DeepCutsScreen` wiring, `ProfileCard`'s `topAlbumName` prop source)
- `src/components/ProfileCard.tsx` (`topAlbumName` prop — stays the same
  shape, just re-sourced)
- `src/components/DeepCutsScreen.tsx`, `src/lib/deepCuts.ts` (being deleted
  — confirm nothing else imports them before removing)
- `src/components/ViewToggle.tsx` (tab labels)
- `src/components/ProfileCard.css`-equivalent rules in `src/index.css` for
  the rank-badge visual language established for Deep Cuts cards (reuse
  it, don't reinvent)

---

## Task 1: `TopAlbum` gains `image`, `getTopAlbums` widens

**Files:** Modify `src/types.ts`, `src/lib/lastfm.ts`, `src/lib/lastfm.test.ts`

Add `image: string | null` to the `TopAlbum` interface. Update
`getTopAlbums`'s mapping to extract the largest image the same way
`getUserInfo` already does (`images.find(i => i.size === "extralarge")?.["#text"]`,
`null` when missing/empty) — check `getUserInfo`'s exact current
implementation in this file and mirror it exactly, don't diverge on the
fallback logic.

Update/add Vitest tests in `lastfm.test.ts` (follow existing
`getTopAlbums` test patterns in that file): album image maps correctly
when present, `null` when the image array is missing or has an empty
`#text`.

Run `npm test`, confirm pass. Commit:
`git add src/types.ts src/lib/lastfm.ts src/lib/lastfm.test.ts && git commit -m "feat: add cover art to getTopAlbums"`

---

## Task 2: `fetchProfileData` fetches a full top-albums list

**Files:** Modify `src/lib/fetchProfileData.ts`, `src/lib/fetchProfileData.test.ts`,
`src/types.ts`

Change `ProfileDataBundle.topAlbum: TopAlbum | null` to
`topAlbums: TopAlbum[]`. Change the `getTopAlbums(...)` call's limit
argument from `1` to `10`. Same cache key as before
(`cacheKey("topAlbums", settings.username)`) — don't change the key,
only the limit/shape of what's cached under it.

Update `fetchProfileData.test.ts`'s existing assertions for the renamed/
reshaped field (mock fetchers should return multiple albums to exercise
the list properly, not just one).

Run `npm test`. Commit:
`git add src/lib/fetchProfileData.ts src/lib/fetchProfileData.test.ts src/types.ts && git commit -m "feat: fetch full top-albums list instead of just the top one"`

---

## Task 3: Delete Deep Cuts

**Files:** Delete `src/components/DeepCutsScreen.tsx`, `src/lib/deepCuts.ts`,
`src/lib/deepCuts.test.ts`

Confirm (grep) nothing else in `src/` imports from `deepCuts` or
`DeepCutsScreen` before deleting — Task 5 removes `App.tsx`'s usage, so if
you do this task before Task 5 in file order that's fine, just don't
leave a dangling import; if it's simpler to do this deletion as part of
Task 5's commit instead, that's an acceptable reordering, use your
judgment on sequencing as long as the repo builds at the end of Task 5.

Commit (or fold into Task 5 — see above):
`git add -A src/components/DeepCutsScreen.tsx src/lib/deepCuts.ts src/lib/deepCuts.test.ts && git commit -m "refactor: remove Deep Cuts lens, replaced by Charts tab"`

---

## Task 4: `ChartsScreen` component

**Files:** Create `src/components/ChartsScreen.tsx`, CSS in `src/index.css`

Props: `topArtists: TopArtist[]` (the graph bundle's existing `core`),
`topAlbums: TopAlbum[]`, `topGenres: GenreCount[]` (whatever
`topGenres()` in `src/lib/profileStats.ts` already returns — check its
actual return type before writing this, don't guess the shape).

Three sections per the spec's "Screen layout":
1. Top Artists — numbered list, rank badge (reuse the exact rank-badge
   CSS/markup pattern from the now-deleted `DeepCutsScreen` — check git
   history (`git show <prior commit>:src/components/DeepCutsScreen.tsx`)
   or `src/index.css` for its still-present `.deep-cuts-screen-card`-badge
   rules if not yet cleaned up) + artist name + playcount
   (`.toLocaleString()`, matching the convention used everywhere else in
   this app for large numbers).
2. Top Albums — card grid (mirror the existing card-grid CSS recipe Deep
   Cuts used, `auto-fill`/`minmax`, reuse `--bg-card`/`--accent-cyan`
   tokens) — cover art `<img>` when `image` is non-null, otherwise a
   placeholder tile matching `ProfileCard`'s existing
   `.profile-card-avatar-placeholder` pattern (check that class for the
   exact visual — same idea, reuse don't reinvent), album name, artist
   name, rank badge.
3. Top Genres — full-width horizontal bar chart, one row per genre, bar
   length proportional to count (normalize against the max), color
   cycling through `--accent-cyan`/`--accent-pink`/`--accent-yellow`/
   `--accent-coral` in that order (same cycle `ProfileCard`'s compact
   genre bars already use — check `ProfileCard.tsx`/its CSS for the exact
   color-cycling logic and reuse it, don't invent a new order).

Empty-state handling per section (each list could be empty for a sparse
account) — short message per section, not a blank gap, matching this
app's established convention (see `DriftChart`'s empty state, `ProfileCard`'s
`?? "—"` fields).

Run `npm run build`. Commit:
`git add src/components/ChartsScreen.tsx src/index.css && git commit -m "feat: add ChartsScreen with top artists, top albums, top genres"`

---

## Task 5: Wire into `App.tsx`, `ProfileCard`, `ViewToggle`

**Files:** Modify `src/App.tsx`, `src/components/ProfileCard.tsx`,
`src/components/ViewToggle.tsx`

- `ViewToggle`: relabel the "Deep Cuts" button/option to "Charts" (widen/
  rename its `lens` union value from `"deepCuts"` to `"charts"` — pick one
  name and use it consistently across every file in this task, `"charts"`
  matches the spec's naming).
- `App.tsx`: remove the `deepCuts` memo (`rankDeepCuts` import gone).
  `lens` state/type updates to `"map" | "charts" | "drift"`. Render
  `ChartsScreen` when `lens === "charts"`, passing `loadState.graph.nodes
  .filter(...)`... actually pass the raw core list — check how `core` is
  available in scope (the `ready` load-state branch currently derives
  `topArtistName`/`topGenreName` from the fetched bundle at fetch time;
  you may need to also stash the bundle's `core: TopArtist[]` array into
  `LoadState`'s `ready` variant the same way `topArtistName` etc. already
  are, since `Graph`'s `GraphNode[]` isn't the same shape as `TopArtist[]`
  — don't try to reverse-engineer `TopArtist` fields out of `GraphNode`,
  thread the real `TopArtist[]` through from where `bundle.core` is
  available, same pattern already used for the other derived fields in
  that branch). Also thread `topGenres` (the full `GenreCount[]`, not just
  the single name) if `App.tsx` doesn't already keep it — check whether
  `loadState.topGenres` already exists in the current code (a prior task
  may have added it for `ProfileCard`'s genre-bar visualizer; if so reuse
  it, don't refetch/recompute).
  `ProfileCard`'s `topAlbumName` prop now derives from
  `profileBundle.topAlbums[0]?.name ?? null` instead of the old single
  `topAlbum` field (same for the `handleRefresh`/initial-fetch paths —
  there are likely two places in `App.tsx` that consume the profile
  fetch's album field, update both).
- `ProfileCard.tsx`: no prop shape change needed (`topAlbumName` stays a
  `string | null`) unless you find it also directly imports the old
  `TopAlbum`/`topAlbum` naming somewhere — check and fix if so.

Run `npm test` (full suite green) and `npm run build` (clean — this is
the task that reconciles every prop/type mismatch left dangling since
Task 1–4).

**Manual verification:** start the dev server, use Playwright with
mocked Last.fm responses (route-intercept `**/2.0/**`, same technique
used earlier in this session — branch on the `method` query param, return
minimal plausible JSON for `user.gettopartists`, `artist.gettoptags`,
`artist.getsimilar`, `artist.getinfo`, `user.getinfo`,
`user.gettopalbums` with a multi-item `album` array including `image`
entries, `user.getrecenttracks`), seed `localStorage.orbeat_settings`,
click the "Charts" tab, screenshot, and confirm: three sections render
with real (mocked) data, album covers show as images (not broken-image
icons — use a real placeholder image URL or a data-URI in the mock so
this is actually checkable), the genre bar chart renders proportional
bars, empty-state text appears if you test with empty mock arrays for
one section. Kill the dev server when done.

Commit: `git add src/App.tsx src/components/ProfileCard.tsx src/components/ViewToggle.tsx && git commit -m "feat: wire Charts tab into App, replacing Deep Cuts"`

---

## Checkpoint

Show the running app — Map / Charts / Drift as the three tabs, Charts
showing ranked top artists, an album-cover grid, and a genre bar chart.
This completes the Deep-Cuts-to-Charts swap.
