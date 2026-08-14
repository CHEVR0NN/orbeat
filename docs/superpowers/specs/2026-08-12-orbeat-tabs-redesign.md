# Orbeat — Tab Navigation Redesign (Map / Deep Cuts / Drift)

Date: 2026-08-12

## Why this exists

The original design spec (`docs/superpowers/specs/2026-08-10-orbeat-design.md`)
deliberately chose "one shared canvas, lenses as filters" over separate
screens — Deep Cuts and Drift were built as small overlay panels on top of
the same `TasteMap`. Having used it, that reads as one UI wearing three
hats rather than three purposeful views. This spec **reverses that
decision**: Map, Deep Cuts, and Drift become three genuinely distinct,
full-screen tabs, each with UI suited to its own job. Drift in particular
gets a real "taste over time" visual instead of a rising/fading list —
the list undersold what should be the most visually distinct lens.

This supersedes the "View toggle" / "Map behavior in the X lens" sections
of both `docs/superpowers/specs/2026-08-10-orbeat-deep-cuts-design.md`
and `docs/superpowers/specs/2026-08-12-orbeat-drift-design.md`. Their
ranking/diffing logic (`rankDeepCuts`, `computeDrift`) and data-fetch
modules (`fetchDriftData`) are unchanged and reused as-is — only the
*presentation* layer changes.

## Navigation model

`App.tsx`'s `ready` state renders a persistent shell — `ProfileCard`
sidebar unchanged — plus a **tab bar** (repurpose `ViewToggle`, already
3-way) that swaps which full-width screen renders in the main area,
instead of the current "TasteMap always renders, panel overlays it"
model:

```
┌──────────────┬───────────────────────────────┐
│              │  [ Map ] [ Deep Cuts ] [Drift] │
│  ProfileCard │─────────────────────────────────
│  (sidebar)   │                                 │
│              │      active tab's screen        │
│              │      fills all remaining space  │
└──────────────┴───────────────────────────────┘
```

`ViewToggle` moves out of `ProfileCard`'s footer band and into this new
tab-bar position (top of the main area) — it's navigation, not a sidebar
control; `ProfileCard` loses its `lens`/`onLensChange` props again.

### Strip the cross-lens coupling out of `TasteMap`

Undo the Deep Cuts / Drift plumbing added into `TasteMap.tsx` for the
overlay model — it no longer applies once each lens has its own screen:
remove the `lens`, `deepCutIds`, `focusNodeId`, `driftByCoreId` props and
every branch keyed on them (the `coresWithDeepCuts` overview glow, the
zoomed-candidate dim multiplier, the drift rising/fading overview
highlight, the `focusNodeId` effect). `TasteMap` goes back to exactly its
Phase-1-shell contract: `{ graph, onSelectNode }`. Its own internal
zoom/orbit/vinyl-galaxy behavior is untouched — only the lens-reactive
additions come out.

## Map tab

Unchanged visual: today's `TasteMap` (galaxy overview + zoom-into-a-core
vinyl view), now simply always rendered as-is when this tab is active, no
lens prop.

## Deep Cuts tab

New full-screen component, `src/components/DeepCutsScreen.tsx` (replaces
`DeepCutsList.tsx`'s role — delete `DeepCutsList.tsx`, its overlay-card
framing doesn't fit a full tab). Same `rankDeepCuts` data, presented as a
proper page instead of a corner list:

- A short header ("Deep Cuts — under-the-radar picks based on who you
  already listen to" or similar, tone matching the rest of the app's
  copy).
- A responsive card grid (not a cramped `<ul>`) — one card per deep cut:
  artist name prominent, "Because you listen to `{sourceCoreArtist}`",
  similarity %, listener count. Reuse the retro-cosmic card language
  already established (`--bg-card`, `--accent-cyan` border/glow family)
  at a size that reads as a real grid, not a shrunk sidebar list.
- Empty state: centered message, same copy as today's
  ("No deep cuts found yet — keep listening.").
- No click-through to the map for v1 (same "no reliable cross-view jump"
  reasoning as before — now doubly true since Map is a separate tab with
  its own independent zoom state).

## Drift tab

New full-screen component, `src/components/DriftScreen.tsx` (replaces
`DriftPanel.tsx`'s role — delete `DriftPanel.tsx`). Same `computeDrift`
data and the same two period `<select>` controls (recent/baseline,
defaulting `3month`/`12month`) and the same adaptation-transparency note,
now at the top of a full page instead of a corner panel. Below that: a
**dumbbell chart**, not a two-column list — this is Drift's "taste over
time" visual.

### Why a dumbbell chart

Per the dataviz skill's form table, "before → after per item" is exactly
a dumbbell: one hue (direction), two shades/positions (baseline dot,
recent dot), connected by a line. `getTopArtists` always fetches the top
`CORE_ARTIST_COUNT = 5` per period (see `src/lib/lastfm.ts`), so a drift
comparison never has more than 10 unique artist names (5 + 5, minus
overlap) — small enough for every row to be directly labeled, no legend
crowding, no folding into "Other."

### Chart spec

- **Axis:** one shared horizontal rank axis, `1` (best) on the left to the
  worst rank present in either period on the right (i.e. inverted — rank
  1 reads as "most listened," not a small number buried at the origin).
  No vertical axis in the traditional sense — each artist is a horizontal
  row, rows ordered by `rankRecent ?? rankBaseline` (best-recent-rank
  first) or grouped rising-then-fading (implementer's call, document
  whichever is picked).
- **Marks:** two dots per row (baseline position, recent position) joined
  by a line, ≥8px dot diameter, 2px line, 4px rounded ends — per the
  dataviz skill's mark spec. A dot with no counterpart (new or dropped
  artist) renders alone at its one known rank with the line running off
  toward an "off-chart" edge marker or a short stub labeled "new"/"gone"
  (implementer's call on exact rendering — must not silently omit the
  artist, since `computeDrift` already guarantees `rankRecent`/
  `rankBaseline` aren't both null for any entry it returns).
- **Color:** two colors by `direction` — reuse the app's existing
  `--accent-cyan` for `rising` and `--accent-coral` for `fading` (already
  used elsewhere in this app for "good"/"alert" meaning respectively —
  `--accent-coral` is the existing error-text color, so it already reads
  as "attention" in this design system). **Deviation from the dataviz
  skill's default lightness-band check, noted deliberately, not
  silently skipped:** running `validate_palette.js` on this pair
  against the app's dark surface (`#0e0b16`) passes chroma floor, CVD
  separation (ΔE 15.7 deutan / 44.2 tritan), normal-vision floor (ΔE
  39.1), and contrast (both ≥ 3:1) — it only fails the OKLCH lightness
  band (0.48–0.67 dark), because both colors sit brighter than that by
  design: this app's entire visual identity is neon-on-black (every
  existing accent token is this bright — see `--accent-yellow`,
  `--accent-pink`, `--accent-purple` in `src/index.css`, all used the
  same way throughout `TasteMap`/`ProfileCard`). Matching the established
  app palette here is correct; a muted, band-compliant pair would clash
  with every other screen. Every mark is also direct-labeled (artist
  name) regardless, which is the skill's own prescribed mitigation for
  a CVD-adjacent concern.
- **Direct labels:** artist name at the row's start (left of the leftmost
  dot), rank number at each dot on hover (see Interaction) and always
  visible for the row's better (leftmost) rank at minimum.
- **Legend:** small, fixed, two entries ("Rising" cyan dot, "Fading" coral
  dot) — this is a 2-slot categorical (direction), not a single series,
  so a legend is required per the dataviz skill's accessibility pass,
  even though every row is also direct-labeled.
- **Interaction:** hovering a row highlights it (full opacity; other rows
  dim slightly) and shows a tooltip with the exact `rankReadout` text
  already used in `DriftPanel` today (`#N → #M` / `#N → new` / `#N →
  gone`) plus both period labels. Reuse `rankReadout`'s logic (move it
  into `src/lib/drift.ts` as an exported helper if not already reusable
  from its current location in `DriftPanel.tsx`, since `DriftPanel.tsx`
  is being deleted).
- **Table-view fallback:** a toggle ("View as table") that swaps the
  chart for a plain `<table>` — columns: Artist, direction, baseline
  rank, recent rank — per the dataviz skill's mandatory accessibility
  pass for any chart.
- **Empty state:** if `computeDrift` returns `[]` (nothing moved), show a
  short message instead of an empty chart canvas ("No movement between
  these two windows — try a wider comparison.").

## Out of scope

- Any change to `rankDeepCuts`, `computeDrift`, `fetchDriftData`,
  `fetchGraphData`, or any other `src/lib` data/logic module — this is a
  presentation-layer-only redesign.
- Click-to-zoom from Deep Cuts cards or Drift chart rows into the Map tab
  (still no reliable cross-tab target, and now the tabs are fully
  independent screens besides).
- Persisting the active tab or Drift's period selection across reloads.
