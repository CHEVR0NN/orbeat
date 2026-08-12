# Orbeat Deep Cuts Implementation Plan

**Goal:** Build the Deep Cuts lens per
`docs/superpowers/specs/2026-08-10-orbeat-deep-cuts-design.md` (as revised
2026-08-12): a ranked "under-the-radar" artist list surfaced as a second
view on the existing Taste Map, with a Map/Deep Cuts toggle in the
`ProfileCard` sidebar.

**Do not start the Drift lens** — it has no design spec yet and is out of
scope here.

**Architecture:** One new pure logic module (`src/lib/deepCuts.ts`,
Vitest-tested like the rest of `src/lib`), two new components
(`ViewToggle.tsx`, `DeepCutsList.tsx`), and integration changes to
`TasteMap.tsx` and `App.tsx`. No new dependencies, no new Last.fm calls —
Deep Cuts is purely a derived view over the `Graph` the app already builds.

Read these first for full context:
- `docs/superpowers/specs/2026-08-10-orbeat-deep-cuts-design.md` (the spec
  — ranking formula, panel content, map dimming behavior)
- `src/components/TasteMap.tsx` (current galaxy/orbit architecture —
  `zoomedGalaxyId`, `selectedNodeId`, `handleCoreClick`,
  `taste-map-node-glow`, `opacityFor`)
- `src/components/ProfileCard.tsx` + the `.profile-card-footer` /
  `.profile-card-controls` CSS in `src/index.css` (styling conventions,
  footer band is where the toggle goes)
- `src/App.tsx` (current state wiring — `selected`, lens state goes here too)

---

## Task 1: `rankDeepCuts` pure module

**Files:** Create `src/lib/deepCuts.ts`, `src/lib/deepCuts.test.ts`

Per spec: only `kind: "candidate"` nodes eligible. Normalize listener
counts on a log scale (`Math.log10(listeners + 1)`, min-max normalized to
0–1) across the candidate set in the input. `score = relevance ×
(1 − normalizedListeners)`. Sort descending, slice to `limit` (default 10).
Empty candidate input → `[]`.

```ts
export interface DeepCut {
  node: GraphNode;
  score: number;
}
export function rankDeepCuts(nodes: GraphNode[], limit = 10): DeepCut[]
```

Write failing Vitest tests first (follow `src/lib/graph.test.ts`'s style):
empty input → `[]`; core nodes present in input are excluded even with a
high relevance; a high-listener/high-similarity candidate ranks below a
low-listener/high-similarity one (normalization correctness); limit
truncation with >10 candidates; single-candidate min-max edge case
(normalizedListeners should not divide by zero — document/handle whatever
you choose when min===max listeners across the set).

Run `npm test`, confirm pass. Commit:
`git add src/lib/deepCuts.ts src/lib/deepCuts.test.ts && git commit -m "feat: add rankDeepCuts pure logic module"`

---

## Task 2: `ViewToggle` component

**Files:** Create `src/components/ViewToggle.tsx`, add its CSS to
`src/index.css`

Two buttons, **Map** / **Deep Cuts**. Props: `lens: "map" | "deepCuts"`,
`onChange: (lens: "map" | "deepCuts") => void`. Style to match
`.profile-card-controls button` (same footer band, same border-bottom
"pressed button" language) but as a two-segment toggle — active segment
gets the cyan neon-glow treatment (`box-shadow: 0 0 12px var(--accent-cyan)`
or similar, matching `.node-detail button:hover`'s glow language from
`src/index.css`).

No Vitest tests (consistent with project's "no component tests for v1"
convention — same as `ProfileCard`, `SettingsPanel`).

Manually verify in isolation is optional here since Task 5 wires it live.
Commit: `git add src/components/ViewToggle.tsx src/index.css && git commit -m "feat: add ViewToggle component"`

---

## Task 3: `DeepCutsList` component

**Files:** Create `src/components/DeepCutsList.tsx`, add its CSS to
`src/index.css`

Props: `deepCuts: DeepCut[]`, `onSelect: (node: GraphNode) => void`.
Rendered as an overlay card in the same position/style as `.node-detail`
(dark card, cyan neon border, `--font-hud`) — reuse `.node-detail`'s CSS
class if the visual match is close enough, or add a sibling
`.deep-cuts-list` class following the same box-shadow/border recipe if a
list needs different internal layout (it will — multiple rows vs. one
detail block).

Each row (per spec): artist name, "Because you listen to
`{sourceCoreArtist}`", `Math.round(match * 100)}%` similar, listener count
via `.toLocaleString()`. Row click calls `onSelect(deepCut.node)`.

Empty state (no deep cuts — e.g. sparse account): render a short message
("No deep cuts found yet — keep listening.") rather than an empty card.

Commit: `git add src/components/DeepCutsList.tsx src/index.css && git commit -m "feat: add DeepCutsList panel component"`

---

## Task 4: `TasteMap` — `lens`, `deepCutIds`, `focusNodeId` props

**Files:** Modify `src/components/TasteMap.tsx`, `src/components/TasteMap.css`

Add three optional props to `TasteMapProps`:

```ts
lens?: "map" | "deepCuts";
deepCutIds?: Set<string>;
focusNodeId?: string | null;
```

Default `lens` to `"map"` when absent so nothing changes for existing
callers mid-refactor.

**`focusNodeId` effect:** add a `useEffect` keyed on `focusNodeId` that,
when it changes to a non-null id, looks up that node's
`sourceCoreArtist` in `graph.nodes` and calls the same state setters
`handleCoreClick` already uses (`setZoomedGalaxyId(sourceCoreArtist)`,
`setSelectedNodeId(focusNodeId)`) — do not duplicate `handleCoreClick`'s
`onSelectNode` call, `App.tsx` already calls it separately from
`DeepCutsList`'s `onSelect`.

**Unzoomed overview dimming (`lens === "deepCuts"` and no
`zoomedGalaxyId`):** for each core node, check whether any node in
`graph.nodes` has `sourceCoreArtist === core.id && deepCutIds.has(id)`.
If so, give that core's `.taste-map-node-glow` circle a brighter/pulsing
variant — simplest approach: add a conditional class
(e.g. `taste-map-node-glow-deepcut`) with a stronger `opacity`/`filter` in
`TasteMap.css`, applied only under this condition. Cores without a deep
cut render exactly as they do today.

**Zoomed dimming (`lens === "deepCuts"` and `zoomedGalaxyId` set):** in the
`orbitPlanets` rendering loop, multiply each candidate's existing computed
opacity by `0.15` unless `deepCutIds.has(node.id)`. Do this at the JSX
`style={{ opacity: ... }}` call site for the planet shapes, not inside the
`orbitPlanets` memo (keep the memo's output lens-independent so it doesn't
recompute the one-shot collision layout when the lens toggles).

When `lens === "map"` (default/absent), skip both blocks entirely — visual
output must be byte-for-byte identical to before this task.

Run `npm run build` (TypeScript check) — no test suite changes needed here
(no component tests for `TasteMap`, consistent with existing convention).
Commit: `git add src/components/TasteMap.tsx src/components/TasteMap.css && git commit -m "feat: add deep-cuts lens dimming/highlight to TasteMap"`

---

## Task 5: Wire into `App.tsx` + `ProfileCard`

**Files:** Modify `src/App.tsx`, `src/components/ProfileCard.tsx`

- `App.tsx` gains `lens` state (`useState<"map" | "deepCuts">("map")`) and
  `focusNodeId` state (`useState<string | null>(null)`).
- Compute `deepCuts = useMemo(() => rankDeepCuts(loadState.graph.nodes), [loadState])`
  only when `loadState.status === "ready"` (guard appropriately — see how
  `topArtistName`/`topGenreName` are already derived conditionally in the
  `ready` branch).
- Pass `lens`, `deepCutIds` (a `Set` built from `deepCuts.map(d => d.node.id)`),
  and `focusNodeId` through to `TasteMap`.
- When `lens === "deepCuts"`, render `DeepCutsList` in place of the
  existing `.node-detail` conditional block — but if `selected` is set
  (a row or map node was clicked), show `.node-detail` instead, same as
  the spec's "list and detail panel are not shown simultaneously" rule
  from Task 3. Clearing `selected` (the existing Close button) returns to
  the list while `lens === "deepCuts"`.
- `DeepCutsList`'s `onSelect` handler: call `setSelected(node)` (existing
  setter) and `setFocusNodeId(node.id)`.
- Reset `focusNodeId` back to `null` right after `TasteMap` consumes it
  (e.g. in the same handler, via a `useEffect` on `focusNodeId` that
  nulls it out next tick) so clicking the same row twice still re-triggers
  the zoom — otherwise a no-op state change won't re-fire `TasteMap`'s effect.
- `ProfileCard`: add a `lens`/`onLensChange` prop pair, render
  `<ViewToggle>` in the footer band above the Refresh/Change Account
  buttons (per the spec's revised View toggle section).

Run `npm test` (full suite must still pass) and `npm run build`.

**Manual verification** (per project convention — real account or
seeded-garbage-key check, be explicit about which is genuinely testable):
`npm run dev`, toggle to Deep Cuts — list appears, cores with deep cuts
show the brighter aura in overview, clicking a row zooms to the right
galaxy and dims non-deep-cut planets, clicking a map node still opens
node-detail and hides the list until closed, toggling back to Map lens
restores normal rendering exactly.

Commit: `git add src/App.tsx src/components/ProfileCard.tsx && git commit -m "feat: wire Deep Cuts lens into App and ProfileCard"`

---

## Checkpoint

Show the running app — Map/Deep Cuts toggle in the sidebar, ranked list,
map highlight/dim behavior in both the overview and zoomed states — before
starting any Drift lens work (which still needs its own design spec,
written and approved before an implementation plan for it exists).
