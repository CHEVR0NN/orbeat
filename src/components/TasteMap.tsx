import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Star, Zap } from "lucide-react";
import { forceSimulation, forceCollide } from "d3-force";
import type { Graph, GraphNode } from "../types";
import "./TasteMap.css";

type SimNode = GraphNode;

const WIDTH = 900;
const HEIGHT = 640;
const MIN_RADIUS = 5;
const MAX_RADIUS = 30;
const MIN_OPACITY = 0.35;
const GALAXY_RADIUS = Math.min(WIDTH, HEIGHT) * 0.32;
const CANDIDATE_ORBIT_RADIUS = 180;

const VINYL_DISC_RADIUS = 300;
const VINYL_TILT_DEG = 60;
// Derives the node layer's Y-projection squash from the same tilt angle the
// CSS `.taste-map-vinyl-tilt` group rotates by, so the flat/untilted node
// layer's approximated foreshortening can't drift out of sync with the
// actual tilted platter's visual foreshortening again.
const VINYL_TILT_PROJECTION = Math.cos((VINYL_TILT_DEG * Math.PI) / 180);
const GROOVE_RING_COUNT = 8;
// Minimum groove radius kept >= 130px so orbiting nodes never visually
// collide with the center spindle label; max radius left as-is (still
// comfortably inside VINYL_DISC_RADIUS) and the existing non-linear curve
// naturally spaces the compressed inner rings out.
const GROOVE_MIN_RADIUS = 130;
const GROOVE_MAX_RADIUS = 275;
// Non-linear spacing (t^1.4) so outer rings get more room than inner ones,
// keeping child planets from crowding as ring index grows.
const GROOVE_RADII = Array.from({ length: GROOVE_RING_COUNT }, (_, i) => {
  const t = i / (GROOVE_RING_COUNT - 1);
  return GROOVE_MIN_RADIUS + (GROOVE_MAX_RADIUS - GROOVE_MIN_RADIUS) * Math.pow(t, 1.4);
});

// Purely-decorative filler grooves layered on top of GROOVE_RADII for a
// denser, more physical vinyl-texture look. Not used for node positioning.
const VINYL_FILLER_GROOVE_COUNT = 40;
const VINYL_FILLER_GROOVE_MIN_RADIUS = 40;
const VINYL_FILLER_GROOVE_MAX_RADIUS = VINYL_DISC_RADIUS - 10;
const VINYL_FILLER_GROOVE_RADII = Array.from({ length: VINYL_FILLER_GROOVE_COUNT }, (_, i) => {
  const t = i / (VINYL_FILLER_GROOVE_COUNT - 1);
  return VINYL_FILLER_GROOVE_MIN_RADIUS + (VINYL_FILLER_GROOVE_MAX_RADIUS - VINYL_FILLER_GROOVE_MIN_RADIUS) * t;
});

const VINYL_LABEL_RADIUS = 80;
const VINYL_LABEL_FILL = "#E0533C";
const VINYL_SPINDLE_FILL = "#000000";

const ORBIT_DURATION_MIN_S = 24;
const ORBIT_DURATION_MAX_S = 110;
// Much slower than the zoomed candidate orbits above -- ambient overview
// drift, not a spinning carousel. Minutes per revolution.
const GALAXY_ORBIT_DURATION_MIN_S = 240;
const GALAXY_ORBIT_DURATION_MAX_S = 600;

const PLANET_COLORS = [
  "var(--accent-cyan)",
  "var(--accent-pink)",
  "var(--accent-yellow)",
  "var(--accent-purple)",
];
const PLANET_GRADIENT_IDS = [
  "taste-map-planet-grad-cyan",
  "taste-map-planet-grad-pink",
  "taste-map-planet-grad-yellow",
  "taste-map-planet-grad-purple",
];
const AURA_GRADIENT_IDS = [
  "taste-map-aura-grad-cyan",
  "taste-map-aura-grad-pink",
  "taste-map-aura-grad-yellow",
  "taste-map-aura-grad-purple",
];
const COLLIDE_PADDING = 40;
const COLLIDE_TICKS = 120;
const LABEL_GAP = 2;
const LABEL_STAGGER_EXTRA = 16;
const DEPTH_SCALE_MIN = 0.7;
const DEPTH_SCALE_MAX = 1.15;
const DEPTH_OPACITY_MIN = 0.65;
const DEPTH_OPACITY_MAX = 1;

function galaxySeed(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s += id.charCodeAt(i);
  return s % 360;
}

interface NodeShapeProps {
  cx: number;
  cy: number;
  r: number;
  color: string;
  fillUrl?: string;
  className: string;
  style: CSSProperties;
  title: string;
}

function VinylCenterLabel({ cx, cy, r, color, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="#120F24" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r * 0.18} fill="#000000" pointerEvents="none" />
    </g>
  );
}

function RingedPlanet({ cx, cy, r, color, fillUrl, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <ellipse
        cx={cx}
        cy={cy}
        rx={r * 1.6}
        ry={r * 0.65}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.8}
        pointerEvents="none"
      />
      <circle cx={cx} cy={cy} r={r} fill={fillUrl ?? color} stroke="#120F24" strokeWidth={1.5} />
      <path
        d={`M ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} Z`}
        fill="#000"
        opacity={0.22}
        pointerEvents="none"
      />
    </g>
  );
}

function CraterMoon({ cx, cy, r, color, fillUrl, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <circle cx={cx} cy={cy} r={r} fill={fillUrl ?? color} stroke="#120F24" strokeWidth={1.5} />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.2} r={r * 0.22} fill="#000" opacity={0.2} pointerEvents="none" />
      <circle cx={cx + r * 0.3} cy={cy + r * 0.3} r={r * 0.14} fill="#000" opacity={0.18} pointerEvents="none" />
      <path
        d={`M ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} Z`}
        fill="#000"
        opacity={0.22}
        pointerEvents="none"
      />
    </g>
  );
}

function GasGiant({ cx, cy, r, color, fillUrl, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <circle cx={cx} cy={cy} r={r} fill={fillUrl ?? color} stroke="#120F24" strokeWidth={1.5} />
      <ellipse cx={cx} cy={cy - r * 0.25} rx={r * 0.92} ry={r * 0.16} fill="#120F24" opacity={0.25} pointerEvents="none" />
      <ellipse cx={cx} cy={cy + r * 0.3} rx={r * 0.85} ry={r * 0.13} fill="#120F24" opacity={0.2} pointerEvents="none" />
      <path
        d={`M ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} Z`}
        fill="#000"
        opacity={0.22}
        pointerEvents="none"
      />
    </g>
  );
}

const PLANET_SHAPES = [RingedPlanet, CraterMoon, GasGiant];

function bracketPath(cx: number, cy: number, half: number, arm: number): string {
  const corners: [number, number, number, number][] = [
    [cx - half, cy - half, 1, 1],
    [cx + half, cy - half, -1, 1],
    [cx - half, cy + half, 1, -1],
    [cx + half, cy + half, -1, -1],
  ];
  return corners
    .map(([x, y, dx, dy]) => `M${x + dx * arm},${y} L${x},${y} L${x},${y + dy * arm}`)
    .join(" ");
}

function SelectionBracket({ cx, cy, half }: { cx: number; cy: number; half: number }) {
  return (
    <path
      d={bracketPath(cx, cy, half, 10)}
      className="taste-map-node-selection-bracket"
      fill="none"
      pointerEvents="none"
    />
  );
}

function NodeLabel({
  cx,
  cy,
  text,
  color,
  onMouseEnter,
  onMouseLeave,
}: {
  cx: number;
  cy: number;
  text: string;
  color: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const width = Math.max(36, text.length * 6.2 + 16);
  const height = 18;
  return (
    <g
      pointerEvents={onMouseEnter ? "auto" : "none"}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <rect
        x={cx - width / 2}
        y={cy}
        width={width}
        height={height}
        rx={height / 2}
        className="taste-map-node-label-bg"
        style={{ stroke: color }}
      />
      <text
        x={cx}
        y={cy + height / 2}
        className="taste-map-node-label-text"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {text}
      </text>
    </g>
  );
}

function radialPosition(index: number, count: number): { px: number; py: number } {
  const angle = index * ((2 * Math.PI) / count);
  const radius = GROOVE_RADII[index % GROOVE_RADII.length];
  return {
    px: radius * Math.cos(angle),
    py: radius * Math.sin(angle),
  };
}

const ORBIT_TARGET_HALF_WIDTH = 320;
const ORBIT_SCALE_MIN = 1.4;
const ORBIT_SCALE_MAX = 3.4;

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Inner groove rings orbit faster than outer ones, like real orbital mechanics.
function orbitDurationFor(ringIndex: number): number {
  const ringPos = ringIndex % GROOVE_RING_COUNT;
  const t = ringPos / (GROOVE_RING_COUNT - 1);
  return lerp(ORBIT_DURATION_MIN_S, ORBIT_DURATION_MAX_S, t);
}

// Animation loop ticks roughly once per animation frame (~60Hz); converts the
// old "seconds per full rotation" duration into "radians per tick" so inner
// rings still turn faster than outer ones under the live rAF loop.
const ORBIT_TICK_HZ = 60;
function orbitSpeedFor(ringIndex: number): number {
  return (2 * Math.PI) / (orbitDurationFor(ringIndex) * ORBIT_TICK_HZ);
}

// Per-core ambient drift speed, varied slightly per id (via galaxySeed) so
// the 5 cores don't move in lockstep.
function galaxyOrbitSpeedFor(id: string): number {
  const t = galaxySeed(id) / 360;
  const durationS = lerp(GALAXY_ORBIT_DURATION_MIN_S, GALAXY_ORBIT_DURATION_MAX_S, t);
  return (2 * Math.PI) / (durationS * ORBIT_TICK_HZ);
}

interface OrbitState {
  radius: number;
  angle: number;
  baseSpeed: number;
  speed: number;
}

function radiusFor(node: GraphNode): number {
  if (node.kind === "core") return MAX_RADIUS;
  return lerp(MIN_RADIUS, MAX_RADIUS, Math.sqrt(node.relevance));
}

function coreRadiusFor(rank: number, coreCount: number): number {
  if (coreCount <= 1) return 32;
  const t = rank / (coreCount - 1);
  return lerp(34, 24, t);
}

function opacityFor(node: GraphNode): number {
  if (node.kind === "core") return 1;
  return lerp(MIN_OPACITY, 1, node.relevance);
}

interface TasteMapProps {
  graph: Graph;
  onSelectNode: (node: GraphNode | null) => void;
  lens?: "map" | "deepCuts";
  deepCutIds?: Set<string>;
  focusNodeId?: string | null;
}

export default function TasteMap({
  graph,
  onSelectNode,
  lens = "map",
  deepCutIds,
  focusNodeId,
}: TasteMapProps) {
  const [zoomedGalaxyId, setZoomedGalaxyId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Cores whose galaxy contains at least one current deep cut -- drives the
  // brighter/pulsing aura cue in the unzoomed overview. Empty (and thus a
  // no-op) whenever the lens isn't "deepCuts" or no deepCutIds were passed.
  const coresWithDeepCuts = useMemo(() => {
    const set = new Set<string>();
    if (lens !== "deepCuts" || !deepCutIds) return set;
    graph.nodes.forEach((n) => {
      if (n.kind !== "core" && n.sourceCoreArtist && deepCutIds.has(n.id)) {
        set.add(n.sourceCoreArtist);
      }
    });
    return set;
  }, [graph, deepCutIds, lens]);

  const galaxyAnchors = useMemo(() => {
    const coreNodes = graph.nodes.filter((n) => n.kind === "core");
    const map = new Map<string, { x: number; y: number }>();
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    if (coreNodes.length <= 1) {
      coreNodes.forEach((n) => map.set(n.id, { x: centerX, y: centerY }));
    } else {
      coreNodes.forEach((n, i) => {
        const baseAngle = i * ((2 * Math.PI) / coreNodes.length) - Math.PI / 2;
        const seed = galaxySeed(n.id);
        const angleJitterDeg = (seed % 33) - 16;
        const radiusFactor = 0.8 + ((seed * 7) % 46) / 100;
        const angle = baseAngle + (angleJitterDeg * Math.PI) / 180;
        const radius = GALAXY_RADIUS * radiusFactor;
        map.set(n.id, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle) * VINYL_TILT_PROJECTION,
        });
      });
    }
    return map;
  }, [graph]);

  // Per-core depth variance (subtle secondary factor on top of rank-based
  // size/opacity), same technique orbitPlanets uses for candidates: squashed
  // y-offset from center as a 0..1 depth proxy -> lerp into scale/opacity.
  const galaxyDepthById = useMemo(() => {
    const map = new Map<string, { depthScale: number; depthOpacity: number }>();
    graph.nodes
      .filter((n) => n.kind === "core")
      .forEach((n) => {
        const anchor = galaxyAnchors.get(n.id);
        if (!anchor) return;
        const depthT = clamp(anchor.y / HEIGHT, 0, 1);
        map.set(n.id, {
          depthScale: lerp(DEPTH_SCALE_MIN, DEPTH_SCALE_MAX, depthT),
          depthOpacity: lerp(DEPTH_OPACITY_MIN, DEPTH_OPACITY_MAX, depthT),
        });
      });
    return map;
  }, [graph, galaxyAnchors]);

  const coreRankById = useMemo(() => {
    const map = new Map<string, number>();
    graph.nodes.filter((n) => n.kind === "core").forEach((n, i) => map.set(n.id, i));
    return map;
  }, [graph]);

  const ringIndexById = useMemo(() => {
    const map = new Map<string, number>();
    if (!zoomedGalaxyId) return map;
    graph.nodes
      .filter((n) => n.kind !== "core" && n.sourceCoreArtist === zoomedGalaxyId)
      .sort((a, b) => b.relevance - a.relevance)
      .forEach((n, i) => map.set(n.id, i));
    return map;
  }, [graph, zoomedGalaxyId]);

  useEffect(() => {
    setZoomedGalaxyId(null);
  }, [graph]);

  // Deep Cuts row clicks drive this via the focusNodeId prop: zoom to the
  // clicked node's galaxy and select it, reusing the same state setters
  // handleCoreClick already drives. onSelectNode is intentionally not
  // called here -- App.tsx calls it separately from DeepCutsList's onSelect.
  useEffect(() => {
    if (!focusNodeId) return;
    const node = graph.nodes.find((n) => n.id === focusNodeId);
    if (!node?.sourceCoreArtist) return;
    setZoomedGalaxyId(node.sourceCoreArtist);
    setSelectedNodeId(focusNodeId);
  }, [focusNodeId, graph]);

  const nodes: SimNode[] = useMemo(() => {
    return graph.nodes.map((n) => {
      if (n.kind === "core") {
        const anchor = galaxyAnchors.get(n.id) ?? { x: WIDTH / 2, y: HEIGHT / 2 };
        return { ...n, x: anchor.x, y: anchor.y };
      }
      return { ...n };
    });
  }, [graph, galaxyAnchors]);

  function handleCoreClick(e: MouseEvent<SVGGElement>, node: SimNode) {
    e.stopPropagation();
    onSelectNode(node);
    setZoomedGalaxyId(node.id);
    setSelectedNodeId(node.id);
  }

  function handleCandidateClick(e: MouseEvent<SVGGElement>, node: SimNode) {
    e.stopPropagation();
    onSelectNode(node);
    setSelectedNodeId(node.id);
  }

  const zoomedAnchor = zoomedGalaxyId ? galaxyAnchors.get(zoomedGalaxyId) ?? null : null;
  const visibleCount = ringIndexById.size;
  const scale = zoomedAnchor
    ? clamp(ORBIT_TARGET_HALF_WIDTH / CANDIDATE_ORBIT_RADIUS, ORBIT_SCALE_MIN, ORBIT_SCALE_MAX)
    : 1;
  const tx = zoomedAnchor ? WIDTH / 2 - scale * zoomedAnchor.x : 0;
  const ty = zoomedAnchor ? HEIGHT / 2 - scale * zoomedAnchor.y : 0;
  const sceneStyle = {
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    transformOrigin: "0 0",
    transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
  };

  // Static layout pass: seeds each orbiting node's initial angle/radius (and
  // its depth-derived display radius/opacity/label offset, which stay fixed
  // for the node's lifetime -- only angle animates every frame). Recomputed
  // only when inputs change, same as before; the live per-frame motion is
  // driven separately by orbitStateRef + the rAF loop below, not by this memo.
  const orbitPlanets = useMemo(() => {
    if (!zoomedGalaxyId) return [];
    const simNodes: SimNode[] = nodes
      .filter((n) => ringIndexById.has(n.id))
      .map((node) => {
        const ringIndex = ringIndexById.get(node.id)!;
        const { px, py } = radialPosition(ringIndex, visibleCount);
        return { ...node, x: px, y: py };
      });
    // One-shot static layout pass: seed a stopped simulation with only a collide
    // force, then tick it forward synchronously and read the resolved x/y back
    // off the nodes. No ongoing animation loop -- a live/continuously-ticking
    // force sim is what caused the earlier chaos/empty-space bug. (The live
    // orbit motion added below animates angle only, using the radius this
    // resolves -- it does not re-run collision.)
    forceSimulation(simNodes)
      .force("collide", forceCollide<SimNode>((d) => {
        const labelHalfWidth = Math.max(36, d.id.length * 6.2 + 16) / 2;
        return Math.max(radiusFor(d) + COLLIDE_PADDING, labelHalfWidth + COLLIDE_PADDING);
      }))
      .stop()
      .tick(COLLIDE_TICKS);
    return simNodes
      .map((node) => {
        const ringIndex = ringIndexById.get(node.id)!;
        const px = node.x ?? 0;
        const py = node.y ?? 0;
        // Flat pre-tilt canvas Y is used as a depth proxy: bottom of canvas =
        // near/foreground, top of canvas = far/background.
        const depthT = clamp((HEIGHT / 2 + py) / HEIGHT, 0, 1);
        const depthScale = lerp(DEPTH_SCALE_MIN, DEPTH_SCALE_MAX, depthT);
        const depthOpacity = lerp(DEPTH_OPACITY_MIN, DEPTH_OPACITY_MAX, depthT);
        return {
          node,
          ringIndex,
          py,
          radius: Math.hypot(px, py),
          angle: Math.atan2(py, px),
          displayRadius: radiusFor(node) * depthScale,
          depthOpacity,
          fill: PLANET_COLORS[ringIndex % PLANET_COLORS.length],
          fillUrl: `url(#${PLANET_GRADIENT_IDS[ringIndex % PLANET_GRADIENT_IDS.length]})`,
          hasPulse: ringIndex % 3 === 2,
        };
      })
      .sort((a, b) => a.py - b.py)
      .map((item, i) => ({
        ...item,
        labelOffset: item.displayRadius + LABEL_GAP + (i % 2 === 1 ? LABEL_STAGGER_EXTRA : 0),
      }));
  }, [nodes, ringIndexById, visibleCount, zoomedGalaxyId]);

  // Ref-based orbit state: mutated directly by the rAF loop every frame, NOT
  // React state. Dozens of nodes updating React state every frame would cause
  // a full re-render storm/jank; instead the loop writes DOM `transform`
  // attributes imperatively via nodeElsRef, reading/writing only this ref.
  const orbitStateRef = useRef<Map<string, OrbitState>>(new Map());
  const nodeElsRef = useRef<Map<string, SVGGElement>>(new Map());
  const tonearmElRef = useRef<SVGLineElement | null>(null);

  // Same imperative-DOM ref pattern as orbitStateRef/nodeElsRef above, but for
  // the overview's 5 core planets: a slow ambient drift so the overview
  // doesn't read as static, kept separate from the zoomed candidate loop so
  // the two can run at very different speeds without interfering.
  const galaxyOrbitStateRef = useRef<Map<string, OrbitState>>(new Map());
  const galaxyNodeElsRef = useRef<Map<string, SVGGElement>>(new Map());

  useEffect(() => {
    const next = new Map<string, OrbitState>();
    orbitPlanets.forEach(({ node, ringIndex, radius, angle }) => {
      const baseSpeed = orbitSpeedFor(ringIndex);
      next.set(node.id, { radius, angle, baseSpeed, speed: baseSpeed });
    });
    orbitStateRef.current = next;
  }, [orbitPlanets]);

  useEffect(() => {
    if (!zoomedGalaxyId) return;
    let frameId: number;
    const tick = () => {
      orbitStateRef.current.forEach((state, id) => {
        state.angle += state.speed;
        const el = nodeElsRef.current.get(id);
        if (el) {
          const x = WIDTH / 2 + state.radius * Math.cos(state.angle);
          const y = HEIGHT / 2 + state.radius * Math.sin(state.angle) * VINYL_TILT_PROJECTION;
          el.setAttribute("transform", `translate(${x}, ${y})`);
        }
      });
      if (selectedNodeId && tonearmElRef.current) {
        const target = orbitStateRef.current.get(selectedNodeId);
        if (target) {
          const x = WIDTH / 2 + target.radius * Math.cos(target.angle);
          const y = HEIGHT / 2 + target.radius * Math.sin(target.angle) * VINYL_TILT_PROJECTION;
          tonearmElRef.current.setAttribute("x2", String(x));
          tonearmElRef.current.setAttribute("y2", String(y));
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [zoomedGalaxyId, selectedNodeId]);

  function handleNodeMouseEnter(id: string) {
    const state = orbitStateRef.current.get(id);
    if (state) state.speed = 0;
  }

  function handleNodeMouseLeave(id: string) {
    const state = orbitStateRef.current.get(id);
    if (state) state.speed = state.baseSpeed;
  }

  // Seeds each core's polar {radius, angle} for the ambient drift loop below,
  // recovering the pre-tilt-squash flat angle/radius from its (now squashed)
  // galaxyAnchors position so the drift stays on the same circle the static
  // layout placed it on.
  useEffect(() => {
    const next = new Map<string, OrbitState>();
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    graph.nodes
      .filter((n) => n.kind === "core")
      .forEach((n) => {
        const anchor = galaxyAnchors.get(n.id);
        if (!anchor) return;
        const px = anchor.x - centerX;
        const pyFlat = (anchor.y - centerY) / VINYL_TILT_PROJECTION;
        const radius = Math.hypot(px, pyFlat);
        const angle = Math.atan2(pyFlat, px);
        const baseSpeed = galaxyOrbitSpeedFor(n.id);
        next.set(n.id, { radius, angle, baseSpeed, speed: baseSpeed });
      });
    galaxyOrbitStateRef.current = next;
  }, [graph, galaxyAnchors]);

  // Ambient overview drift -- active only while unzoomed. The single zoomed
  // core's position is handled entirely by sceneStyle's pan/zoom transform,
  // so this loop stays out of that path.
  useEffect(() => {
    if (zoomedGalaxyId) return;
    let frameId: number;
    const tick = () => {
      galaxyOrbitStateRef.current.forEach((state, id) => {
        state.angle += state.speed;
        const el = galaxyNodeElsRef.current.get(id);
        if (el) {
          const x = WIDTH / 2 + state.radius * Math.cos(state.angle);
          const y = HEIGHT / 2 + state.radius * Math.sin(state.angle) * VINYL_TILT_PROJECTION;
          el.setAttribute("transform", `translate(${x}, ${y})`);
        }
      });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      galaxyOrbitStateRef.current.forEach((_, id) => {
        const el = galaxyNodeElsRef.current.get(id);
        const anchor = galaxyAnchors.get(id);
        if (el && anchor) {
          el.setAttribute("transform", `translate(${anchor.x}, ${anchor.y})`);
        }
      });
    };
  }, [zoomedGalaxyId, galaxyAnchors]);

  function handleGalaxyMouseEnter(id: string) {
    const state = galaxyOrbitStateRef.current.get(id);
    if (state) state.speed = 0;
  }

  function handleGalaxyMouseLeave(id: string) {
    const state = galaxyOrbitStateRef.current.get(id);
    if (state) state.speed = state.baseSpeed;
  }

  const tonearmTargetState =
    zoomedGalaxyId && selectedNodeId
      ? orbitPlanets.find((p) => p.node.id === selectedNodeId) ?? null
      : null;

  return (
    <div className="taste-map-wrap">
      {zoomedGalaxyId && (
        <button className="taste-map-back-btn" onClick={() => setZoomedGalaxyId(null)}>
          &larr; back to galaxies
        </button>
      )}
      <div className="taste-map-decor" aria-hidden="true">
        <Star className="taste-map-decor-icon taste-map-decor-1" />
        <Zap className="taste-map-decor-icon taste-map-decor-2" />
        <svg
          className="taste-map-decor-icon taste-map-decor-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <ellipse cx="12" cy="15" rx="10" ry="3.5" />
          <path d="M6 14 C6 8, 18 8, 18 14" />
        </svg>
        <Star className="taste-map-decor-icon taste-map-decor-4" />
        <Zap className="taste-map-decor-icon taste-map-decor-5" />
        <svg className="taste-map-decor-icon taste-map-decor-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" strokeDasharray="2 4" />
        </svg>
        <svg className="taste-map-decor-icon taste-map-decor-7" viewBox="0 0 24 24">
          <circle cx="6" cy="6" r="2" fill="currentColor" />
          <circle cx="14" cy="10" r="1.3" fill="currentColor" />
          <circle cx="9" cy="16" r="1" fill="currentColor" />
        </svg>
        <Star className="taste-map-decor-icon taste-map-decor-8" />
        <svg
          className="taste-map-decor-icon taste-map-decor-9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 21 L15 9" strokeDasharray="2 3" strokeLinecap="round" />
          <path d="M15 9 L15 14 M15 9 L10 9" strokeLinecap="round" />
        </svg>
        <Zap className="taste-map-decor-icon taste-map-decor-10" />
        <svg className="taste-map-decor-icon taste-map-decor-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="7" strokeDasharray="2 4" />
        </svg>
        <svg className="taste-map-decor-icon taste-map-decor-12" viewBox="0 0 24 24">
          <circle cx="6" cy="6" r="1.6" fill="currentColor" />
          <circle cx="13" cy="4" r="1" fill="currentColor" />
          <circle cx="10" cy="12" r="1.2" fill="currentColor" />
        </svg>
      </div>
      <svg className="taste-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <defs>
          <radialGradient id="taste-map-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0)" />
            <stop offset="70%" stopColor="rgba(0, 0, 0, 0)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.55)" />
          </radialGradient>
          <radialGradient id="taste-map-bg-gradient" cx="50%" cy="50%" r="75%">
            <stop offset="0%" stopColor="#2A1236" />
            <stop offset="75%" stopColor="#0E0B16" />
          </radialGradient>
          {PLANET_COLORS.map((color, i) => (
            <radialGradient key={PLANET_GRADIENT_IDS[i]} id={PLANET_GRADIENT_IDS[i]} cx="35%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85} />
              <stop offset="40%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </radialGradient>
          ))}
          {PLANET_COLORS.map((color, i) => (
            <radialGradient key={AURA_GRADIENT_IDS[i]} id={AURA_GRADIENT_IDS[i]} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </radialGradient>
          ))}
          <filter id="taste-map-glow-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="url(#taste-map-bg-gradient)"
          onClick={() => {
            setZoomedGalaxyId(null);
            setSelectedNodeId(null);
          }}
        />
        <g className="taste-map-scene">
          <g
            className="taste-map-vinyl-tilt"
            style={{ transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px`, "--vinyl-tilt": `${VINYL_TILT_DEG}deg` } as CSSProperties}
          >
            <g className="taste-map-vinyl-spin" style={{ transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px` }}>
              <circle
                cx={WIDTH / 2}
                cy={HEIGHT / 2}
                r={VINYL_DISC_RADIUS}
                className="taste-map-vinyl-disc"
                pointerEvents="none"
              />
              {VINYL_FILLER_GROOVE_RADII.map((r) => (
                <circle
                  key={`groove-filler-${r}`}
                  cx={WIDTH / 2}
                  cy={HEIGHT / 2}
                  r={r}
                  className="taste-map-vinyl-groove"
                  pointerEvents="none"
                />
              ))}
              {GROOVE_RADII.map((r) => (
                <circle
                  key={`groove-${r}`}
                  cx={WIDTH / 2}
                  cy={HEIGHT / 2}
                  r={r}
                  className="taste-map-vinyl-groove"
                  pointerEvents="none"
                />
              ))}
              {!zoomedGalaxyId && (
                <g pointerEvents="none">
                  <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={VINYL_LABEL_RADIUS} fill={VINYL_LABEL_FILL} />
                  <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={VINYL_LABEL_RADIUS * 0.18} fill={VINYL_SPINDLE_FILL} />
                </g>
              )}
            </g>
          </g>
          <g className="taste-map-nodes-layer">
          {tonearmTargetState && (
            <line
              ref={tonearmElRef}
              x1={WIDTH / 2}
              y1={0}
              x2={WIDTH / 2 + tonearmTargetState.radius * Math.cos(tonearmTargetState.angle)}
              y2={HEIGHT / 2 + tonearmTargetState.radius * Math.sin(tonearmTargetState.angle) * VINYL_TILT_PROJECTION}
              className="taste-map-tonearm"
              pointerEvents="none"
            />
          )}
          {zoomedGalaxyId &&
            orbitPlanets.map(({ node, ringIndex, radius, angle, displayRadius, fill, fillUrl, depthOpacity, hasPulse, labelOffset }) => {
              const PlanetShape = PLANET_SHAPES[ringIndex % PLANET_SHAPES.length];
              const initialX = WIDTH / 2 + radius * Math.cos(angle);
              const initialY = HEIGHT / 2 + radius * Math.sin(angle) * VINYL_TILT_PROJECTION;
              const deepCutDimMultiplier =
                lens === "deepCuts" && deepCutIds && !deepCutIds.has(node.id) ? 0.15 : 1;
              return (
                <g
                  key={`planet-${node.id}`}
                  ref={(el) => {
                    if (el) nodeElsRef.current.set(node.id, el);
                    else nodeElsRef.current.delete(node.id);
                  }}
                  transform={`translate(${initialX}, ${initialY})`}
                >
                  <g
                    onClick={(e) => handleCandidateClick(e, node)}
                    onMouseEnter={() => handleNodeMouseEnter(node.id)}
                    onMouseLeave={() => handleNodeMouseLeave(node.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {selectedNodeId === node.id && (
                      <SelectionBracket cx={0} cy={0} half={displayRadius + 10} />
                    )}
                    <PlanetShape
                      cx={0}
                      cy={0}
                      r={displayRadius}
                      color={fill}
                      fillUrl={fillUrl}
                      className={`taste-map-node-candidate${hasPulse ? " taste-map-node-pulse" : ""}`}
                      style={{
                        opacity: opacityFor(node) * depthOpacity * deepCutDimMultiplier,
                        transition: "opacity 350ms ease",
                      }}
                      title={node.id}
                    />
                  </g>
                  <NodeLabel
                    cx={0}
                    cy={labelOffset}
                    text={node.id}
                    color={fill}
                    onMouseEnter={() => handleNodeMouseEnter(node.id)}
                    onMouseLeave={() => handleNodeMouseLeave(node.id)}
                  />
                </g>
              );
            })}
          <g style={sceneStyle}>
            {nodes
              .filter((node) => node.kind === "core" && (!zoomedGalaxyId || node.id === zoomedGalaxyId))
              .map((node) => {
                const rank = coreRankById.get(node.id) ?? 0;
                const coreCount = coreRankById.size || 1;
                const depth = galaxyDepthById.get(node.id);
                const depthScale = depth?.depthScale ?? 1;
                const depthOpacity = depth?.depthOpacity ?? 1;
                const r = coreRadiusFor(rank, coreCount) * depthScale;
                const isZoomedCenter = node.id === zoomedGalaxyId;
                const auraColor = PLANET_COLORS[rank % PLANET_COLORS.length];
                const CorePlanetShape = PLANET_SHAPES[rank % PLANET_SHAPES.length];
                const centerSquashStyle: CSSProperties | undefined = isZoomedCenter
                  ? { transform: `rotateX(${VINYL_TILT_DEG}deg)`, transformOrigin: "0px 0px" }
                  : undefined;
                const hasDeepCut = !zoomedGalaxyId && coresWithDeepCuts.has(node.id);
                return (
                  <g
                    key={node.id}
                    ref={(el) => {
                      if (el) galaxyNodeElsRef.current.set(node.id, el);
                      else galaxyNodeElsRef.current.delete(node.id);
                    }}
                    transform={`translate(${node.x}, ${node.y})`}
                  >
                    <circle
                      className={`taste-map-node-glow${hasDeepCut ? " taste-map-node-glow-deepcut" : ""}`}
                      cx={0}
                      cy={0}
                      r={r + 16 + (galaxySeed(node.id) % 14)}
                      fill={`url(#${AURA_GRADIENT_IDS[rank % AURA_GRADIENT_IDS.length]})`}
                      filter="url(#taste-map-glow-blur)"
                      pointerEvents="none"
                      style={{
                        animationDuration: `${5 + (galaxySeed(node.id) % 5)}s`,
                        animationDelay: `-${galaxySeed(node.id) % 6}s`,
                        ...centerSquashStyle,
                      }}
                    />
                    {selectedNodeId === node.id && (
                      <SelectionBracket cx={0} cy={0} half={r + 16} />
                    )}
                    <circle
                      cx={0}
                      cy={0}
                      r={r * 1.4}
                      fill={`url(#${AURA_GRADIENT_IDS[rank % AURA_GRADIENT_IDS.length]})`}
                      style={{ filter: `drop-shadow(0 0 16px ${auraColor})`, ...centerSquashStyle }}
                      pointerEvents="none"
                    />
                    <g
                      onClick={(e) => handleCoreClick(e, node)}
                      onMouseEnter={() => handleGalaxyMouseEnter(node.id)}
                      onMouseLeave={() => handleGalaxyMouseLeave(node.id)}
                    >
                      {isZoomedCenter ? (
                        <VinylCenterLabel
                          cx={0}
                          cy={0}
                          r={r}
                          color={VINYL_LABEL_FILL}
                          className="taste-map-node-core"
                          style={{ opacity: opacityFor(node) * depthOpacity, pointerEvents: "auto", transition: "opacity 350ms ease", ...centerSquashStyle }}
                          title={node.id}
                        />
                      ) : (
                        <CorePlanetShape
                          cx={0}
                          cy={0}
                          r={r}
                          color={auraColor}
                          fillUrl={`url(#${PLANET_GRADIENT_IDS[rank % PLANET_GRADIENT_IDS.length]})`}
                          className="taste-map-node-core"
                          style={{ opacity: opacityFor(node) * depthOpacity, pointerEvents: "auto", transition: "opacity 350ms ease" }}
                          title={node.id}
                        />
                      )}
                      <NodeLabel cx={0} cy={-(r + 42)} text={node.id} color={auraColor} />
                    </g>
                  </g>
                );
              })}
          </g>
          </g>
        </g>
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="url(#taste-map-vignette)"
          pointerEvents="none"
          style={{
            opacity: zoomedGalaxyId ? 1 : 0,
            transition: "opacity 700ms ease",
          }}
        />
      </svg>
    </div>
  );
}
