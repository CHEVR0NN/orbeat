# Orbeat — Deep Cuts Lens Design Spec

Date: 2026-08-10

## Summary

Adds the Deep Cuts lens to the existing Taste Map: a ranked list of
under-the-radar artist recommendations, surfaced as a second view on the
same shared graph rather than a separate screen. Builds directly on the
Phase 1 implementation (`docs/superpowers/plans/2026-08-10-orbeat-phase1-taste-map.md`)
and the Retro Cosmic Pop / Y2K visual system already committed to `main`.

Drift (the third lens) is a separate future plan — the view toggle built
here is two-way (Map / Deep Cuts) only, per explicit decision below.

## Ranking logic

New pure module `src/lib/deepCuts.ts`, tested with Vitest like the rest of
`src/lib`:

```ts
export interface DeepCut {
  node: GraphNode;
  score: number;
}

export function rankDeepCuts(nodes: GraphNode[], limit = 10): DeepCut[]
```

- Only `kind: "candidate"` nodes are eligible (core artists are never deep
  cuts — they're the anchor, not a discovery).
- Listener counts are normalized on a **log scale** across the candidate
  set present in the current graph (`Math.log10(listeners + 1)`, min-max
  normalized to 0–1), since raw listener counts span several orders of
  magnitude and a linear normalization would let a handful of huge artists
  flatten everything else toward 0.
- **Composite score:** `score = relevance × (1 − normalizedListeners)`.
  `relevance` here is the existing Last.fm similarity score already stored
  on `GraphNode` (0–1). A candidate that's both highly similar *and*
  obscure scores highest; a wildly popular artist or a barely-similar one
  both get pulled down, even if they're strong on the other axis alone.
- Sorted descending, sliced to `limit` (default 10).
- Empty candidate list returns `[]`, not an error — consistent with the
  existing "sparse coverage degrades gracefully" principle from the Phase
  1 spec.

## View toggle (revised 2026-08-12 — see note below)

> The original text below said the toggle goes into "the existing
> header," which no longer exists — `App.tsx` was rebuilt around a
> `ProfileCard` sidebar (`docs/superpowers/plans/2026-08-10-orbeat-profile-card-shell.md`).
> It also assumed `TasteMap` was still a single flat force-graph; since
> then it was rebuilt as zoomable per-core "vinyl galaxies" (an unzoomed
> overview showing only the 5 core planets, and a zoomed view per core
> showing that core's candidate planets orbiting it) — see current
> `src/components/TasteMap.tsx`. The plan below accounts for both.

New component `src/components/ViewToggle.tsx`: two buttons, **Map** /
**Deep Cuts**, styled with the existing retro-cosmic tokens (active state
gets the neon-glow treatment already used elsewhere — e.g. cyan box-shadow
on the selected button, matching `.settings-panel button:hover`'s glow
language). Slots into `ProfileCard`'s footer band, above the existing
Refresh/Change Account controls. `App.tsx` gains a `lens: "map" | "deepCuts"`
state, default `"map"`.

## Deep Cuts list panel

New component `src/components/DeepCutsList.tsx`, rendered in the
`.map-area` overlay position currently used by `.node-detail` (dark card,
neon border, `--font-hud` labels) when `lens === "deepCuts"`. Not a
separate screen; the map stays visible and reacts (see below). When a row
is clicked, `App.tsx` shows the existing node-detail panel instead of the
list for that click (same pattern already used for node selection) — the
list panel and node-detail panel are not shown simultaneously.

Each row:
- Artist name (`--font-display` or bold `--font-body`, TBD in
  implementation — small enough decision to leave to the build step)
- "Because you listen to `{sourceCoreArtist}`"
- Similarity: `Math.round(match * 100)}%`
- Listener count, formatted with `.toLocaleString()`

Clicking a row both (a) calls the existing `onSelectNode` callback (opens
the existing node-detail panel, reusing Phase 1's), and (b) tells
`TasteMap` to zoom into that row's `sourceCoreArtist` galaxy — see
`focusNodeId` prop below. Without this, a deep cut belonging to a
non-zoomed core would be picked from the list but invisible on the map.

## Map behavior in the Deep Cuts lens

`TasteMap` gains two optional props: `deepCutIds: Set<string>` (the
current top-10 deep-cut node IDs) and `focusNodeId: string | null` (set by
`DeepCutsList` row clicks, per above — on change, `TasteMap` sets its
internal `zoomedGalaxyId` to that node's core and `selectedNodeId` to the
node itself, reusing the exact same state the existing `handleCoreClick`
path already drives).

Rendering, driven by `lens` (passed through as a third prop) — no changes
to the force simulation, orbit physics, or galaxy layout in either case,
this is a pure rendering filter on top of the existing physics:

- **Unzoomed galaxy overview** (only core planets visible — candidates
  aren't rendered here at all currently): each core planet whose galaxy
  contains at least one of the top-10 deep cuts gets a small added visual
  cue (e.g. its `taste-map-node-glow` aura gets a brief pulse/brighter
  aura variant) so a galaxy worth zooming into is discoverable before
  zooming in. Cores with zero deep cuts render unchanged.
- **Zoomed into one galaxy**: candidate planets not in `deepCutIds` get an
  additional opacity multiplier (existing computed opacity × ~0.15) so
  they fade toward the background; the top-10 deep-cut planets (if any
  belong to this galaxy) render at their normal relevance-scaled opacity,
  popping against the faded rest.
- When `lens === "map"` (default), rendering is unchanged from today —
  `deepCutIds`/`focusNodeId` have no visual effect.

## Testing

- `rankDeepCuts` gets Vitest unit tests: empty input, single candidate,
  normalization correctness (a high-listener/high-similarity candidate
  vs. a low-listener/high-similarity one — confirm the obscure one ranks
  higher), limit truncation, core nodes excluded even if present in input.
- No component tests for `ViewToggle`/`DeepCutsList`/the `TasteMap` dimming
  logic — consistent with the "no component/UI test framework for v1"
  decision from the Phase 1 spec. Manual browser verification instead.

## Out of scope

- Drift lens and its third toggle button — separate future plan.
- Changing the underlying fetch/graph pipeline — Deep Cuts is purely a
  derived view over data Phase 1 already fetches and caches.
