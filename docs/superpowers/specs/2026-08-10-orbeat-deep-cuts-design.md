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

## View toggle

New component `src/components/ViewToggle.tsx`: two buttons, **Map** /
**Deep Cuts**, styled with the existing retro-cosmic tokens (active state
gets the neon-glow treatment already used elsewhere — e.g. cyan box-shadow
on the selected button, matching `.settings-panel button:hover`'s glow
language). `App.tsx` gains a `lens: "map" | "deepCuts"` state, default
`"map"`.

## Deep Cuts list panel

New component `src/components/DeepCutsList.tsx`, rendered alongside the
map (same panel language as the existing `.node-detail` aside — dark card,
neon border, `--font-hud` labels) when `lens === "deepCuts"`. Not a
separate screen; the map stays visible and reacts (see below).

Each row:
- Artist name (`--font-display` or bold `--font-body`, TBD in
  implementation — small enough decision to leave to the build step)
- "Because you listen to `{sourceCoreArtist}`"
- Similarity: `Math.round(match * 100)}%`
- Listener count, formatted with `.toLocaleString()`

Clicking a row calls the same `onSelectNode` callback `TasteMap` already
uses, opening the existing node-detail panel — no new detail UI, reuses
Phase 1's.

## Map behavior in the Deep Cuts lens

`TasteMap` gains an optional prop carrying the current lens and the set of
top-10 deep-cut node IDs. When `lens === "deepCuts"`:
- Core nodes and any candidate **not** in the top-10 set get an additional
  opacity multiplier (existing computed opacity × ~0.15) so they fade
  toward the background.
- The top-10 deep-cut nodes render at their normal (already relevance-
  scaled) opacity, so they visually pop against the faded rest of the map.
- No changes to the force simulation itself — this is a pure rendering
  filter on top of the existing physics, not a re-layout. Switching lenses
  should feel like a filter/spotlight, not the map rebuilding itself.

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
