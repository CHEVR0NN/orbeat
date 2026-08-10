# Orbeat — Design Spec

Date: 2026-08-10

## Summary

Orbeat is a static, client-side web tool that turns a user's own Last.fm
listening history into a visual, explorable map of their taste — and uses
that map to power discovery (deep cuts), self-insight (taste drift over
time), and clustering (genre/style groupings). Fully open to other users:
anyone can plug in their own free Last.fm API key and username. No backend,
no accounts, no cost — ever — for you or anyone using it.

## Stack

- **Vite + React** — consistent with Prism, good fit for the amount of
  interactive state (period selectors, node selection, filters).
- **TypeScript** — data shapes coming back from Last.fm (artists, tags,
  similarity scores) get typed end-to-end; catches shape mismatches early.
- **d3-force**, used directly (no `react-force-graph` wrapper) — keeps the
  dependency list to what was originally approved and gives full control
  over the custom node rendering described under Visual design. Nodes
  attract/repel based on similarity, settling naturally into a "drifting
  from center" arrangement without manual positioning.
- **CSS Modules** (Vite native, no extra dependency) for component styles,
  plus a small global stylesheet for shared design tokens (palette, font,
  gradients).
- No router — single-screen SPA with view toggles (Map / Deep Cuts / Drift),
  not separate pages.
- No backend. All Last.fm API calls happen client-side, directly from the
  user's browser to Last.fm, using their own key.
- **localStorage** for: the user's API key + username (their own device
  only), and a timestamped cache of fetched Last.fm data (see Caching).
- **Vitest** for unit tests on pure logic (see Testing) — consistent with
  Prism.

## Auth & multi-user model

- On first load, a settings panel asks for a Last.fm API key + username.
- Both are stored in localStorage only — never sent anywhere but Last.fm's
  API directly. No server, so no possibility of Orbeat itself seeing or
  storing anyone's key.
- This makes Orbeat usable by anyone with a free Last.fm account and API
  key, with zero ongoing cost to you as the builder — you're shipping code,
  not a hosted service with your own credentials.

## Core data & feature logic

### Data foundation (shared by all three features)

Fetch, on load or refresh:

- `user.getTopArtists` — per period (7day / 1month / 3month / 6month /
  12month / overall)
- `artist.getTopTags` — per top artist, for genre/style clustering
- `artist.getSimilar` — per top artist, fan-out for discovery candidates
- `artist.getInfo` — playcount/listener counts, for filtering toward
  under-the-radar picks

**Graph size**: top 5 artists (by selected period) anchor the core; fan-out
fetches up to 10 similar artists per core artist (~50 candidates before
dedup/filtering). Keeps the map legible and keeps first-load API volume
modest — roughly 5 getTopTags + 5 getSimilar + ~50 getInfo calls, all
cached 24h.

### Feature 1: Deep Cuts finder

For each top artist, fetch similar artists via `artist.getSimilar`. Filter
candidates by: not already in the user's top artists, low global listener
count relative to genre peers, high similarity score to the seed artist.
Rank and present as a list: "because you listen to X" → suggested artist +
why it's a deep cut (listener count context).

### Feature 2: Taste Drift tracker

Fetch `user.getTopArtists` at two periods (e.g. current 1month vs. previous
1month, or 3month vs. 12month — user-selectable comparison window).
Diff the two lists: artists/tags rising (new or climbing rank), fading
(dropping rank or absent from the more recent period). Present as a simple
before/after comparison, not just raw numbers — frame it as "what's coming
in, what's fading out."

### Feature 3: Taste Map (the core visual)

Central node(s) = current top artists (the "core"). Radiating nodes =
similar/tag-adjacent artists, positioned by a force-directed layout where
distance from center reflects similarity/relevance rather than being
manually placed. Deep cuts appear as outer-ring nodes; drift data can
animate a node's position shifting inward/outward across a time toggle.
This is the shared visual language tying all three features together —
Deep Cuts and Drift are really just different lenses on this same map.

## Visual design

Direction: **nodes drifting from a center** — this is both the literal
mechanic (force-directed layout, similarity = distance) and the visual
identity for the whole app.

- Central node(s): your current top artists, visually anchored,
  larger/brighter than the rest.
- Outer nodes: similarity-ranked, sized/opacity scaled by relevance —
  fainter and smaller the further from center.
- Edges: thin connecting lines from center to related nodes, not a dense
  mesh — keep it legible, not a hairball.
- Color: one accent hue for "established" (core/top artists), a second for
  "deep cut candidates," a third (or animated transition) for drift
  movement — so the map is scannable by color at a glance, not just
  position.
- Motion: nodes should visibly settle into place on load (force simulation
  running briefly, then stabilizing) — this reinforces the "drifting"
  concept rather than a static, pre-arranged layout.
- Interaction: hover/click a node for artist details (name, similarity
  score, listener count, "why it's here"); drag to nudge nodes (force sim
  should let this feel physical, not locked).
- Overall tone: clean, not cluttered — this is a data-driven visual, so
  legibility takes priority over decoration. No heavy skeuomorphic styling.
- Typography: deferred to the style-prototype checkpoint (step 4 of Build
  order below) — self-hosted font choice, no CDN dependency, so the app
  keeps working fully offline/static.

## Views / navigation

Single-screen app with a lightweight toggle between three lenses on the
same underlying map:

- **Map** (default) — the full taste-map visualization
- **Deep Cuts** — same map, filtered/highlighted to just discovery
  candidates, with the ranked list alongside
- **Drift** — same map, with a time-comparison control (e.g. a slider or
  two-period selector) animating node position changes

Not three separate pages — one shared canvas, different filters/lenses
applied to it.

## Caching

- Cache fetched Last.fm data (top artists, tags, similar artists, info) in
  localStorage with a timestamp per period/query.
- Refetch only if cache is stale (e.g. older than 24h) or user explicitly
  refreshes — avoids hammering Last.fm's API on every visit and respects
  their per-key rate limits.
- The similar-artist fan-out (one call per top artist) is the highest-
  volume part of this app — batch/rate-limit client-side (sequential queue
  with a small inter-request delay) and rely on the cache aggressively.

## Error handling

- Invalid/missing API key or username → inline message in the settings
  panel, no crash, clear instructions to get a free key.
- Rate limit hit → inline notice, fall back to cached data if available
  rather than blocking the UI.
- Artist with no similar-artist data (sparse Last.fm coverage) → simply
  omit from the map rather than erroring.

## Export

- Not a priority for v1 (unlike Prism, there's no obvious "file" output
  users need) — but a "share my map" image export (canvas → PNG) is a
  reasonable v2 addition once the core is working.

## Testing

- Manual verification: test with a real account across sparse and dense
  listening histories (a very active scrobbler vs. a light one) to confirm
  the map and deep-cuts filtering degrade gracefully with little data.
- Pure-function logic (similarity ranking, drift diffing, deep-cut
  filtering, cache staleness) gets plain Vitest unit tests — same approach
  as Prism.
- No component/UI test framework needed for v1.

## Build order

1. Scaffold project (Vite + React + TypeScript), settings panel for API
   key/username
2. Data foundation — fetch + cache top artists, tags, similar artists, info
3. **Taste Map** — force-directed layout with core + radiating nodes
   (build this before the other two features, since it's the shared
   visual foundation)
4. **Style-prototype checkpoint** — confirm the map's look/feel (colors,
   node sizing, motion on settle) before layering features on top
5. **Deep Cuts** lens — filtering/ranking logic + list view alongside map
6. **Drift** lens — time-comparison logic + animated node movement
7. Polish pass: caching robustness, error states, rate-limit handling
