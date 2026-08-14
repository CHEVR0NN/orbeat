# Orbeat — Drift Lens Design Spec

Date: 2026-08-12

## Summary

Adds the third and final lens from `docs/superpowers/specs/2026-08-10-orbeat-design.md`
("Feature 2: Taste Drift tracker"): a before/after comparison of the user's
top artists across two Last.fm listening-history windows — what's rising,
what's fading. Builds on the Deep Cuts lens
(`docs/superpowers/plans/2026-08-12-orbeat-deep-cuts.md`, already shipped)
and reuses its `ViewToggle` (extended to three options) and its overlay-panel
pattern.

## Two adaptations from the original design doc (read before implementing)

1. **"Current period vs. previous period" isn't fetchable.** Last.fm's
   `user.gettopartists` only offers windows ending *now*
   (`7day`/`1month`/`3month`/`6month`/`12month`/`overall`), no offset
   parameter for "the 1month window before this one." So "before/after"
   here means comparing two of those windows directly against each other
   — e.g. `3month` (narrower, more recent-weighted) vs. `12month`
   (wider) — not true calendar before/after. This is the spec's own
   fallback example ("3month vs. 12month"), just made the only supported
   mode rather than one of two. Be upfront about this in the UI copy
   (see Panel content below).
2. **Drift entries are core-tier only, and the map highlight is
   best-effort.** `user.gettopartists` is the same endpoint the existing
   graph's core nodes come from — drift is fundamentally about the
   top-N artist list, not the similar-artist/candidate fan-out. The
   currently-rendered map's core nodes are always the user's top 5 for
   whatever period `App.tsx` fetches for the graph (`"overall"`,
   unchanged by this feature). A drifting artist from the drift
   comparison may or may not be one of those 5 rendered core nodes. So:
   the ranked list is the source of truth (always complete); the map
   only gets a highlight for whichever drift entries happen to match an
   already-rendered core node's id. No new fetch/graph rebuild, no
   candidate/orbit changes — drift never touches zoomed-galaxy rendering
   at all, only the unzoomed overview's core planets, same shape as Deep
   Cuts' overview-only highlight.

## Ranking/diff logic

New pure module `src/lib/drift.ts`, tested with Vitest like the rest of
`src/lib`:

```ts
export interface DriftEntry {
  name: string;
  direction: "rising" | "fading";
  rankRecent: number | null;   // rank in the narrower/recent period, null if absent
  rankBaseline: number | null; // rank in the wider/baseline period, null if absent
}

export function computeDrift(recent: TopArtist[], baseline: TopArtist[]): DriftEntry[]
```

- `rising`: artist is in `recent` and either (a) absent from `baseline`
  (new), or (b) `rankRecent < rankBaseline` (numerically lower = better
  placement in the narrower/recent window than in the wider one).
- `fading`: artist is in `baseline` and either (a) absent from `recent`,
  or (b) `rankRecent > rankBaseline`.
- An artist ranked identically in both lists produces no entry (neither
  rising nor fading) — only movers are surfaced, per the original spec's
  "what's coming in, what's fading out" framing.
- Empty `recent` and/or `baseline` → whatever entries are still derivable
  (e.g. empty `recent` means every `baseline` artist is `fading`), never
  an error — same "sparse coverage degrades gracefully" principle used
  throughout this project.
- No sorting/limit requirement in the module itself — the component
  decides display order (see below).

## Data fetching

New function in `src/lib/fetchDrift.ts` (mirrors `fetchProfileData.ts`'s
shape — small, no fan-out):

```ts
export async function fetchDriftData(
  settings: Settings,
  recentPeriod: Period,
  baselinePeriod: Period,
  fetchers = { getTopArtists },
  forceRefresh = false
): Promise<{ recent: TopArtist[]; baseline: TopArtist[] }>
```

Two cached calls via the existing `getCachedOrFetch`/`cacheKey` from
`src/lib/cache.ts` (same pattern as every other fetch module) — one per
period, `cacheKey("topArtists", settings.username, period)`, which is
the *same* cache key `fetchGraphData` already uses for its own
`user.gettopartists` call, so if the app's default `"overall"` graph
fetch and a drift period happen to coincide, no duplicate network call
occurs.

## Period selection

Two `<select>` controls (reusing the existing `Period` type — the 6
values already used by `getTopArtists`) in the `DriftPanel` header:
"Recent: [3 Month ▾]" / "Compared to: [12 Month ▾]", defaulting to
`3month` / `12month` (the spec's own example pair). Changing either
triggers a refetch via `fetchDriftData`. No validation needed beyond
what the `<select>` already constrains to valid `Period` values.

## View toggle (extends the existing one)

`ViewToggle` (already built for Deep Cuts) gains a third option:
**Map / Deep Cuts / Drift**. `App.tsx`'s `lens` state widens to
`"map" | "deepCuts" | "drift"`.

## Panel content

New component `src/components/DriftPanel.tsx`, same overlay-card
language as `DeepCutsList` (dark card, cyan neon border, `--font-hud`).
Rendered when `lens === "drift"`, replacing `DeepCutsList`/`node-detail`
in that slot (same "only one overlay panel visible" rule already
established for Deep Cuts).

Content:
- The two period selectors (above).
- A one-line note making adaptation #1 legible to the user, e.g. "Comparing
  your top artists across two windows — not calendar before/after."
- Two columns or two labeled sections: **Rising** and **Fading**, each
  listing its `DriftEntry` rows: artist name + a compact rank readout
  (e.g. `#2 → new` for a newly-appearing rising artist, `#4 → #1` for a
  climbing one, `#3 → gone` for a fully-dropped fading artist, `#1 → #5`
  for a fading-but-still-present one). Empty section → short message
  ("Nothing rising this window" / "Nothing fading this window"), not a
  blank gap.
- No row click behavior required for v1 (unlike Deep Cuts' rows, these
  artists aren't guaranteed to be graph nodes at all — see adaptation #2
  — so there's no reliable click target to wire to `onSelectNode`/zoom).
  Static list only.

## Map behavior in the Drift lens

Only the unzoomed galaxy overview is affected (see adaptation #2). For
each rendered core node, if its id matches a `rising` `DriftEntry.name`,
give its `taste-map-node-glow` aura the same brighter/pulsing treatment
Deep Cuts uses for `coresWithDeepCuts` (reuse that CSS class/approach,
don't invent a second one) — reuse is fine since the two lenses are
mutually exclusive (`lens` is a single value), no visual collision. If it
matches a `fading` entry instead, apply the existing dim treatment
(candidate-dim opacity multiplier already used elsewhere, ~0.15,
applied to the core's rendered opacity instead). A core matching neither
renders unchanged. Zoomed-galaxy view is entirely unaffected by
`lens === "drift"` (no candidate-level drift data exists — adaptation
#2).

`TasteMap` gains one more optional prop, `driftByCoreId?: Map<string, "rising" | "fading">`,
computed in `App.tsx` by intersecting `computeDrift`'s output with the
current graph's core node ids. Threaded through the same `lens`-gated
rendering branch Deep Cuts already added — `lens === "map"` and
`lens === "deepCuts"` remain byte-for-byte unaffected by this prop's
presence.

## Testing

- `computeDrift` — Vitest unit tests: empty `recent`, empty `baseline`,
  both empty, a new artist (rising, no baseline rank), a fully-dropped
  artist (fading, no recent rank), a climbing artist (present both,
  better rank in recent), a fading-but-present artist (present both,
  worse rank in recent), an unchanged-rank artist (no entry produced).
- `fetchDriftData` — Vitest tests following `fetchProfileData.test.ts`'s
  pattern (injected fake fetchers): normal fetch for two periods, cache
  reuse on second call with the same period pair, a period change
  triggers a refetch for the changed period only (the unchanged period's
  cache entry is still reused — verify via call counts).
- No component tests for `DriftPanel`/`ViewToggle`'s third option/the
  `TasteMap` drift-highlight branch — consistent with the project's
  "no component/UI test framework for v1" decision already applied to
  Deep Cuts. Manual browser verification instead.

## Out of scope

- Any change to the zoomed-galaxy/candidate-orbit rendering.
- Click-to-zoom from a `DriftPanel` row (no reliable node-id guarantee —
  see adaptation #2 and Panel content above).
- Persisting the user's chosen period pair across reloads — resets to
  the `3month`/`12month` default each session, consistent with `lens`
  itself not being persisted either (Deep Cuts precedent).
