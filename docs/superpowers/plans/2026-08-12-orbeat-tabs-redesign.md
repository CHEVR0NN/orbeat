# Orbeat Tab Navigation Redesign — Implementation Plan

**Goal:** Implement `docs/superpowers/specs/2026-08-12-orbeat-tabs-redesign.md`
— turn Map/Deep Cuts/Drift from one shared canvas with overlay panels into
three genuinely separate full-screen tabs, with Drift getting a real
dumbbell "taste over time" chart instead of a rising/fading list.

**Read the full spec first**, then read the *current* state of every file
below before editing — several were touched by the two prior lens builds
(Deep Cuts, then Drift) and have accumulated coupling this plan removes:
- `src/components/TasteMap.tsx` + `.css` (has `lens`/`deepCutIds`/
  `focusNodeId`/`driftByCoreId` props and branches to strip)
- `src/components/ProfileCard.tsx` (has `lens`/`onLensChange` props to
  remove, and hosts `ViewToggle` today — moving out)
- `src/components/ViewToggle.tsx` (reused as-is for the new tab bar,
  probably needs new CSS for its new position — check its current styling
  assumptions)
- `src/App.tsx` (current `lens` state, `deepCuts`/`driftEntries`/
  `driftByCoreId` memos, the `selected`-vs-panel overlay-exclusivity
  logic — most of this is kept, some re-plumbed)
- `src/components/DeepCutsList.tsx`, `src/components/DriftPanel.tsx`
  (being deleted, but read them first — their data-shaping logic,
  e.g. `DriftPanel`'s `rankReadout` and `PERIOD_OPTIONS`, needs to move
  somewhere before the file goes away)
- `src/lib/deepCuts.ts`, `src/lib/drift.ts`, `src/lib/fetchDrift.ts`
  (unchanged — just confirm their exports match what the new screens need)

Also skim the dataviz skill's mark/interaction conventions referenced in
the spec if you want the source reasoning: `references/marks-and-anatomy.md`
and `references/interaction.md` under the dataviz skill (ask if you can't
locate it — not part of this repo).

No changes to any Vitest-tested `src/lib` module in this plan — every task
here is presentation-layer. Run `npm test` after each task anyway to
confirm nothing broke, and `npm run build` at every task (TypeScript will
catch prop-shape mismatches as you strip/move things).

---

## Task 1: Strip lens coupling out of `TasteMap`

**Files:** Modify `src/components/TasteMap.tsx`, `src/components/TasteMap.css`

Remove the `lens`, `deepCutIds`, `focusNodeId`, `driftByCoreId` props from
`TasteMapProps` and every branch/effect keyed on them (the deep-cuts
overview glow and zoomed-candidate dim, the drift overview highlight/dim,
the `focusNodeId`-triggered zoom effect). `TasteMap`'s own zoom/orbit/
vinyl-galaxy mechanics are untouched — only remove what the Deep Cuts and
Drift lens-overlay work added on top. Remove any now-unused CSS classes
those branches introduced in `TasteMap.css` (check for
`coresWithDeepCuts`-style class names, drift highlight/dim classes) —
only remove ones confirmed unused after this change, don't touch
anything else in that file.

Run `npm run build` — will show every caller still passing the removed
props (that's `App.tsx`, fixed in Task 6). It's fine for `App.tsx` to be
red between this task and Task 6; don't fix it here.

Commit: `git add src/components/TasteMap.tsx src/components/TasteMap.css && git commit -m "refactor: strip lens-overlay coupling out of TasteMap"`

---

## Task 2: Move reusable bits out of the panels being deleted, then delete them

**Files:** Modify `src/lib/drift.ts`; Delete `src/components/DeepCutsList.tsx`,
`src/components/DriftPanel.tsx`

From `DriftPanel.tsx`, move `rankReadout(entry: DriftEntry): string` into
`src/lib/drift.ts` as a named export (pure function, belongs in the logic
module now that two screens will need it — Task 5's chart tooltip and
Task 5's table-view fallback). Also move `PERIOD_OPTIONS` (the
`{value: Period, label: string}[]` array) into `src/lib/drift.ts` as an
export, or duplicate it directly in `DriftScreen.tsx` if that reads
cleaner — implementer's call, but don't leave it only reachable from a
deleted file.

`DeepCutsList.tsx` has no logic worth preserving beyond what
`rankDeepCuts` already provides — just delete it.

Delete both component files. Don't fix their now-broken imports in
`App.tsx`/`ProfileCard.tsx` yet — Tasks 3/4/5/6 replace those usages.

Commit: `git add -A src/lib/drift.ts src/components/DeepCutsList.tsx src/components/DriftPanel.tsx && git commit -m "refactor: extract rankReadout/PERIOD_OPTIONS from DriftPanel before deleting overlay panels"`

(Use `git rm`-equivalent staging for the deleted files — `git add -A` on
exactly those paths is fine here since they're deletions, not a blanket
stage-everything.)

---

## Task 3: Relocate `ViewToggle` from `ProfileCard` footer to a top tab bar

**Files:** Modify `src/components/ProfileCard.tsx`, `src/index.css`

Remove `ViewToggle` usage and its `lens`/`onLensChange` props from
`ProfileCard.tsx` entirely (props removed from `ProfileCardProps` too).
`ProfileCard` goes back to being lens-unaware.

Add a new `.app-tabbar` (or similar) styling in `src/index.css` for
`ViewToggle` to live in — a horizontal bar at the top of the main content
area (see spec's layout diagram), matching the app's retro-cosmic style
already used elsewhere (`--accent-cyan` glow on the active tab, consistent
with `ViewToggle`'s existing internal active-state styling — check what
it already does before adding redundant styles, this task is about
*position* in the layout, not reinventing the toggle's own look). Actual
placement JSX for `ViewToggle` happens in Task 6 (`App.tsx`) — this task
only removes it from `ProfileCard` and prepares the CSS slot.

Run `npm run build` (still red until Task 6, that's expected).

Commit: `git add src/components/ProfileCard.tsx src/index.css && git commit -m "refactor: remove ViewToggle from ProfileCard footer, add top-tabbar CSS slot"`

---

## Task 4: `DeepCutsScreen` component

**Files:** Create `src/components/DeepCutsScreen.tsx`, CSS in `src/index.css`

Props: `deepCuts: DeepCut[]` (from `src/lib/deepCuts.ts` — same type
`DeepCutsList` used). Per spec: header line, responsive card grid (CSS
grid, `auto-fill`/`minmax` or similar so it reflows across the full tab
width — this is the main difference from the old cramped `<ul>`), one
card per deep cut with artist name, "Because you listen to
`{sourceCoreArtist}`", similarity %, listener count. Reuse
`--bg-card`/`--accent-cyan` border/glow tokens already established for
cards elsewhere (`.node-detail`, `.settings-panel`) rather than inventing
a new card recipe. Empty state per spec (centered message, same copy as
today).

No `onSelect`/click-through prop — per spec, out of scope for v1.

Commit: `git add src/components/DeepCutsScreen.tsx src/index.css && git commit -m "feat: add DeepCutsScreen with full-width card grid"`

---

## Task 5: `DriftChart` (dumbbell) + `DriftScreen`

**Files:** Create `src/components/DriftChart.tsx`, `src/components/DriftScreen.tsx`,
CSS in `src/index.css`

This is the plan's centerpiece — implement per the spec's full "Chart
spec" section (axis, marks, color, direct labels, legend, interaction,
table-view fallback, empty state). Key contract points, restated from the
spec so they're not missed:

- `DriftChart` props: `entries: DriftEntry[]`. Pure presentation — no
  fetching, no period state.
- Horizontal rank axis, rank 1 (best) on the left. One row per entry, an
  entry with only one known rank (new/dropped artist) still renders (spec
  requires this — `computeDrift` never returns an entry with both ranks
  null).
- SVG marks: ≥8px dots, 2px connecting line, colored by `direction`
  (`var(--accent-cyan)` rising / `var(--accent-coral)` fading) — the
  spec's Color section documents *why* these exact tokens are correct
  here despite the dataviz skill's default lightness-band check, don't
  re-litigate it, just use them.
- Row hover: highlight that row (full opacity), dim others, tooltip with
  `rankReadout(entry)` (now in `src/lib/drift.ts` per Task 2) + both
  period labels.
- Small fixed 2-entry legend (Rising cyan / Fading coral) always visible,
  not hover-only.
- A "View as table" toggle that swaps the SVG for a plain `<table>`
  (Artist / Direction / Baseline rank / Recent rank columns) — internal
  component state (`useState`), no prop needed.
- Empty state (`entries.length === 0`): short message, no empty canvas.

`DriftScreen` wraps `DriftChart` with the page-level chrome: header, the
two period `<select>` controls (move `PERIOD_OPTIONS` in from Task 2,
same recent/baseline pattern `DriftPanel` had), the adaptation-
transparency note, then `DriftChart`. Props:
`entries: DriftEntry[]`, `recentPeriod: Period`, `baselinePeriod: Period`,
`onRecentPeriodChange`, `onBaselinePeriodChange` — same shape
`DriftPanel` had, so `App.tsx`'s Task 6 wiring barely changes.

Run `npm run build`.

Commit: `git add src/components/DriftChart.tsx src/components/DriftScreen.tsx src/index.css && git commit -m "feat: add DriftChart dumbbell visualization and DriftScreen"`

---

## Task 6: Wire the tab bar and three screens into `App.tsx`

**Files:** Modify `src/App.tsx`

- Keep existing `lens` state (now `"map" | "deepCuts" | "drift"`, already
  that shape from the prior build) and all existing data state/memos
  (`deepCuts`, `driftEntries`, period state, etc.) — this task is about
  *where* things render, not re-deriving data that already works.
- Remove anything now-dead from the old overlay model: `driftByCoreId`
  memo (no longer consumed now that `TasteMap` doesn't take it — Task 1),
  `focusNodeId` state (same reason), the `selected`-vs-`lens` overlay-
  exclusivity branching for `DeepCutsList`/`DriftPanel` (they're gone).
- Render `ViewToggle` once, in the new tab-bar position (top of the main
  content area, per Task 3's CSS slot), always visible regardless of
  which tab is active.
- Below the tab bar, render exactly one of:
  - `lens === "map"`: `TasteMap` (now prop-shape-reverted per Task 1) +
    the existing `.node-detail` overlay when `selected` is set — this
    pairing is unchanged from the app's original Phase-1 behavior, it
    only applies within the Map tab now.
  - `lens === "deepCuts"`: `DeepCutsScreen` with the existing `deepCuts`
    memo.
  - `lens === "drift"`: `DriftScreen` with the existing drift state/memo
    and period change handlers (same props `DriftPanel` used).
- `selected`/`setSelected` only need to be relevant while `lens === "map"`
  now — no cross-tab node-detail logic needed since Deep Cuts/Drift don't
  call `onSelectNode` anymore (their screens have no such callback per
  Tasks 4/5).

Run `npm test` (full suite green — no `src/lib` changes in this plan so
count should be unchanged from before this plan started) and
`npm run build` (must be clean now — this is the task that reconciles
every prop mismatch left dangling since Task 1).

**Manual verification:** `npm run dev`. Confirm: tab bar always visible
above the active screen, switching tabs swaps the entire main area (not
an overlay on top of the map), Map tab behaves exactly as before this
plan, Deep Cuts tab shows the card grid, Drift tab shows the dumbbell
chart with working period selectors, hover tooltips, legend, and table
toggle. Be explicit about what's genuinely run vs. code-read-only (no
real Last.fm account in this environment — same caveat as prior plans).

Commit: `git add src/App.tsx && git commit -m "feat: wire tab bar and three full-screen views into App"`

---

## Checkpoint

Show the running app. This completes the tab-navigation redesign — Map,
Deep Cuts, and Drift are now three independent full-screen views sharing
only the `ProfileCard` sidebar and the tab bar, with Drift built around a
real dumbbell rank-change chart instead of a text list.
