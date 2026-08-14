# Orbeat Drift Implementation Plan

**Goal:** Build the Drift lens per
`docs/superpowers/specs/2026-08-12-orbeat-drift-design.md`: a rising/fading
before-after comparison of the user's top artists across two selectable
Last.fm periods, as a third `ViewToggle` option alongside the already-shipped
Map and Deep Cuts lenses.

**Architecture:** One new pure logic module (`src/lib/drift.ts`), one new
fetch module (`src/lib/fetchDrift.ts`, mirrors `fetchProfileData.ts`), one
new component (`DriftPanel.tsx`), and integration changes to `ViewToggle.tsx`,
`TasteMap.tsx`, and `App.tsx`. No new dependencies.

Read these first:
- `docs/superpowers/specs/2026-08-12-orbeat-drift-design.md` (full spec —
  read the two "adaptations" sections carefully, they constrain the design)
- `docs/superpowers/plans/2026-08-12-orbeat-deep-cuts.md` (the sibling lens
  just shipped — `ViewToggle`, `DeepCutsList`, and the `TasteMap`
  `lens`/overview-highlight pattern this plan extends rather than duplicates)
- `src/lib/fetchProfileData.ts` + `src/lib/cache.ts` (fetch/cache pattern to
  mirror for `fetchDrift.ts`)
- `src/components/TasteMap.tsx` (current `lens`, `deepCutIds`,
  `coresWithDeepCuts`-style overview highlight from the Deep Cuts work —
  reuse its CSS classes for the "rising" glow, don't add a parallel set)
- `src/App.tsx` (current `lens` state, `deepCuts` memo — Drift's wiring
  follows the same shape)

---

## Task 1: `computeDrift` pure module

**Files:** Create `src/lib/drift.ts`, `src/lib/drift.test.ts`

```ts
export interface DriftEntry {
  name: string;
  direction: "rising" | "fading";
  rankRecent: number | null;
  rankBaseline: number | null;
}
export function computeDrift(recent: TopArtist[], baseline: TopArtist[]): DriftEntry[]
```

Rules (from spec): rising = in `recent` and (absent from `baseline` OR
`rankRecent < rankBaseline`); fading = in `baseline` and (absent from
`recent` OR `rankRecent > rankBaseline`); identical rank in both → no
entry. `TopArtist` is already defined in `src/types.ts` (has `.name`,
`.rank`).

Write failing Vitest tests first (`src/lib/graph.test.ts` style): empty
`recent`, empty `baseline`, both empty, new artist (rising, `rankBaseline: null`),
fully-dropped artist (fading, `rankRecent: null`), climbing artist (rising,
both ranks present), fading-but-present artist (fading, both ranks
present), unchanged-rank artist (produces no entry — assert it's absent
from the result array, not just check a field).

Run `npm test`, confirm pass. Commit:
`git add src/lib/drift.ts src/lib/drift.test.ts && git commit -m "feat: add computeDrift pure logic module"`

---

## Task 2: `fetchDriftData`

**Files:** Create `src/lib/fetchDrift.ts`, `src/lib/fetchDrift.test.ts`

```ts
export async function fetchDriftData(
  settings: Settings,
  recentPeriod: Period,
  baselinePeriod: Period,
  fetchers = { getTopArtists },
  forceRefresh = false
): Promise<{ recent: TopArtist[]; baseline: TopArtist[] }>
```

Two `getCachedOrFetch` calls (from `src/lib/cache.ts`), each keyed
`cacheKey("topArtists", settings.username, period)` — this is
deliberately the *same* cache key `fetchGraphData.ts` already uses for
its own top-artists call, so a period overlap shares the cache entry.
Mirror `fetchProfileData.ts`'s structure exactly (default fetchers
object, `forceRefresh` threaded through both calls).

Write failing Vitest tests first (`fetchProfileData.test.ts` style):
fetches both periods; reuses cache on an identical second call (assert
call counts); calling again with one period changed only refetches that
period (assert the unchanged period's fetcher call count didn't
increase); `forceRefresh` bypasses cache for both.

Run `npm test`, confirm pass. Commit:
`git add src/lib/fetchDrift.ts src/lib/fetchDrift.test.ts && git commit -m "feat: add cached fetchDriftData for two-period comparison"`

---

## Task 3: `ViewToggle` — third option

**Files:** Modify `src/components/ViewToggle.tsx`

Widen its `lens` prop type to `"map" | "deepCuts" | "drift"` and add a
third "Drift" button using the exact same styling/active-state pattern
the existing two buttons use — no new CSS needed unless the 3-segment
layout needs a minor width adjustment (check it doesn't overflow the
`ProfileCard` footer band at 340px sidebar width; adjust
`.view-toggle`-family CSS in `src/index.css` only if it visibly breaks).

Run `npm run build`. Commit:
`git add src/components/ViewToggle.tsx src/index.css && git commit -m "feat: add Drift as a third ViewToggle option"`

(Skip the CSS file in the `git add` if you didn't need to touch it.)

---

## Task 4: `DriftPanel` component

**Files:** Create `src/components/DriftPanel.tsx`, add its CSS to
`src/index.css`

Props: `entries: DriftEntry[]`, `recentPeriod: Period`,
`baselinePeriod: Period`, `onRecentPeriodChange: (p: Period) => void`,
`onBaselinePeriodChange: (p: Period) => void`. Same overlay-card visual
language as `DeepCutsList` (reuse its CSS class or a sibling following the
same recipe, per that component's own precedent).

Layout per spec's "Panel content" section: two `<select>` period pickers
at the top (options = the 6 `Period` values, human-readable labels e.g.
"3 Month"/"12 Month" — check `src/types.ts` for the exact `Period` union
values to enumerate), a one-line adaptation-transparency note, then
**Rising** / **Fading** sections each rendering their filtered
`entries.filter(e => e.direction === "rising" | "fading")`, with the
`#N → #M` / `#N → new` / `#N → gone` rank-readout format described in the
spec, and an empty-section fallback message per side.

No click handlers on rows (spec: out of scope for v1 — no reliable node
target).

Commit: `git add src/components/DriftPanel.tsx src/index.css && git commit -m "feat: add DriftPanel component"`

---

## Task 5: `TasteMap` — `driftByCoreId` prop

**Files:** Modify `src/components/TasteMap.tsx`, `src/components/TasteMap.css`
if a new dim class is genuinely needed (prefer reusing existing classes).

Add one optional prop: `driftByCoreId?: Map<string, "rising" | "fading">`.
In the unzoomed-overview core-rendering branch (same branch Deep Cuts'
`coresWithDeepCuts` check lives in), when `lens === "drift"`:
- if `driftByCoreId.get(node.id) === "rising"`, apply the exact same
  brighter/pulsing aura treatment already used for
  `coresWithDeepCuts.has(node.id)` in the Deep Cuts branch — reuse that
  CSS class/conditional, don't create a second "rising" variant, the two
  lenses never render simultaneously so there's no collision.
- if `"fading"`, apply the existing ~0.15 dim-opacity-multiplier approach
  (same technique used for non-deep-cut candidates when zoomed, but here
  applied to the core's own rendered opacity in the overview).
- no match (or `lens !== "drift"`): unchanged.

This prop and its branch must not affect rendering when `lens` is `"map"`
or `"deepCuts"` — verify by re-reading how the existing `deepCutIds`
branch is gated and mirror that gating exactly.

Run `npm run build`. Commit:
`git add src/components/TasteMap.tsx src/components/TasteMap.css && git commit -m "feat: add drift rising/fading highlight to TasteMap overview"`

(Skip the CSS file in the `git add` if you didn't need to touch it.)

---

## Task 6: Wire into `App.tsx`

**Files:** Modify `src/App.tsx`

- Widen the `lens` state type to include `"drift"`.
- Add `recentPeriod`/`baselinePeriod` state, `useState<Period>("3month")` /
  `useState<Period>("12month")` (spec's default pair).
- Fetch drift data with `fetchDriftData` when `lens === "drift"` becomes
  active or either period changes (a `useEffect` keyed on
  `[settings, lens, recentPeriod, baselinePeriod]`, guarded to only fire
  when `lens === "drift"` — no need to prefetch drift data while on other
  lenses). Store the result in state; compute
  `driftEntries = useMemo(() => computeDrift(recent, baseline), [recent, baseline])`.
- Compute `driftByCoreId` as a `useMemo`: for each entry in
  `driftEntries`, if its `name` matches a current graph core node's id
  (only meaningful when `loadState.status === "ready"`), map
  `name -> direction`.
- Render `DriftPanel` in the same overlay slot as `DeepCutsList`/
  `node-detail`, gated on `lens === "drift"`, following the existing
  "only one overlay panel visible at a time" rule.
- Pass `lens` and `driftByCoreId` through to `TasteMap`.

Run `npm test` (full suite green) and `npm run build`.

**Manual verification:** `npm run dev`, toggle to Drift — panel shows
with period selectors defaulted to 3 Month / 12 Month, rising/fading
lists populate (or show empty-state messages), changing either selector
refetches and updates the lists, any core node matching a rising/fading
entry shows the highlight/dim in the unzoomed overview, other lenses
render unaffected. Be explicit in your report about what's genuinely
verifiable without a real Last.fm account vs. what's a code read-through
only (same convention used in the Deep Cuts and ProfileCard plans).

Commit: `git add src/App.tsx && git commit -m "feat: wire Drift lens into App"`

---

## Checkpoint

Show the running app — three-way Map/Deep Cuts/Drift toggle, period
selectors, rising/fading lists, overview highlight/dim — this completes
all three lenses from the original design spec's build order. No further
lens work is planned after this; next steps (if any) would be the design
spec's step-7 "polish pass" (caching robustness, error states, rate-limit
handling) or the deferred v2 "share my map" PNG export, neither in scope
here.
