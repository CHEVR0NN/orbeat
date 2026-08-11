import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
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
const GROOVE_RING_COUNT = 8;
const GROOVE_MIN_RADIUS = 55;
const GROOVE_MAX_RADIUS = 275;
// Non-linear spacing (t^1.4) so outer rings get more room than inner ones,
// keeping child planets from crowding as ring index grows.
const GROOVE_RADII = Array.from({ length: GROOVE_RING_COUNT }, (_, i) => {
  const t = i / (GROOVE_RING_COUNT - 1);
  return GROOVE_MIN_RADIUS + (GROOVE_MAX_RADIUS - GROOVE_MIN_RADIUS) * Math.pow(t, 1.4);
});

const VINYL_LABEL_COLOR = "var(--accent-yellow)";
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
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="#120F24" strokeWidth={2.5} />
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

function NodeLabel({ cx, cy, text }: { cx: number; cy: number; text: string }) {
  const width = Math.max(36, text.length * 6.2 + 16);
  const height = 18;
  return (
    <g pointerEvents="none">
      <rect
        x={cx - width / 2}
        y={cy}
        width={width}
        height={height}
        rx={height / 2}
        className="taste-map-node-label-bg"
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
}

export default function TasteMap({ graph, onSelectNode }: TasteMapProps) {
  const [zoomedGalaxyId, setZoomedGalaxyId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

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
          y: centerY + radius * Math.sin(angle),
        });
      });
    }
    return map;
  }, [graph]);

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
    // force sim is what caused the earlier chaos/empty-space bug.
    forceSimulation(simNodes)
      .force("collide", forceCollide<SimNode>((d) => radiusFor(d) + COLLIDE_PADDING))
      .stop()
      .tick(COLLIDE_TICKS);
    return simNodes
      .map((node) => {
        const ringIndex = ringIndexById.get(node.id)!;
        const px = node.x ?? 0;
        const py = node.y ?? 0;
        // True post-rotateX(45deg) screen position isn't readable from JS, so
        // pre-tilt canvas Y is used as a depth proxy: bottom of canvas = near/
        // foreground, top of canvas = far/background.
        const depthT = clamp((HEIGHT / 2 + py) / HEIGHT, 0, 1);
        const depthScale = lerp(DEPTH_SCALE_MIN, DEPTH_SCALE_MAX, depthT);
        const depthOpacity = lerp(DEPTH_OPACITY_MIN, DEPTH_OPACITY_MAX, depthT);
        return {
          node,
          ringIndex,
          px,
          py,
          displayRadius: radiusFor(node) * depthScale,
          depthOpacity,
          fill: PLANET_COLORS[ringIndex % PLANET_COLORS.length],
          fillUrl: `url(#${PLANET_GRADIENT_IDS[ringIndex % PLANET_GRADIENT_IDS.length]})`,
          hasPulse: ringIndex % 3 === 2,
        };
      })
      .sort((a, b) => a.py - b.py);
  }, [nodes, ringIndexById, visibleCount, zoomedGalaxyId]);

  const tonearmTarget =
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
        <g className="taste-map-vinyl-tilt" style={{ transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px` }}>
          <g className="taste-map-vinyl-spin" style={{ transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px` }}>
            <circle
              cx={WIDTH / 2}
              cy={HEIGHT / 2}
              r={VINYL_DISC_RADIUS}
              className="taste-map-vinyl-disc"
              pointerEvents="none"
            />
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
            {tonearmTarget && (
              <line
                x1={WIDTH / 2}
                y1={0}
                x2={WIDTH / 2 + tonearmTarget.px}
                y2={HEIGHT / 2 + tonearmTarget.py}
                className="taste-map-tonearm"
                pointerEvents="none"
              />
            )}
            {zoomedGalaxyId &&
              orbitPlanets.map(({ node, ringIndex, px, py, displayRadius, fill, fillUrl, depthOpacity, hasPulse }, i) => {
                const PlanetShape = PLANET_SHAPES[ringIndex % PLANET_SHAPES.length];
                const labelOffset = displayRadius + LABEL_GAP + (i % 2 === 1 ? LABEL_STAGGER_EXTRA : 0);
                return (
                  <g key={`planet-${node.id}`}>
                    <g onClick={(e) => handleCandidateClick(e, node)} style={{ cursor: "pointer" }}>
                      {selectedNodeId === node.id && (
                        <SelectionBracket cx={WIDTH / 2 + px} cy={HEIGHT / 2 + py} half={displayRadius + 10} />
                      )}
                      <PlanetShape
                        cx={WIDTH / 2 + px}
                        cy={HEIGHT / 2 + py}
                        r={displayRadius}
                        color={fill}
                        fillUrl={fillUrl}
                        className={`taste-map-node-candidate${hasPulse ? " taste-map-node-pulse" : ""}`}
                        style={{ opacity: opacityFor(node) * depthOpacity, transition: "opacity 350ms ease" }}
                        title={node.id}
                      />
                    </g>
                    <g
                      className="taste-map-label-counter-spin"
                      transform={`translate(${WIDTH / 2 + px}, ${HEIGHT / 2 + py + labelOffset})`}
                      style={{ transformOrigin: "0px 0px" }}
                    >
                      <g style={{ transform: "rotateX(-45deg)", transformOrigin: "0px 0px" }}>
                        <NodeLabel cx={0} cy={0} text={node.id} />
                      </g>
                    </g>
                  </g>
                );
              })}
          </g>
        </g>
        <g style={sceneStyle}>
          {nodes
            .filter((node) => node.kind === "core")
            .map((node) => {
              const rank = coreRankById.get(node.id) ?? 0;
              const coreCount = coreRankById.size || 1;
              const r = coreRadiusFor(rank, coreCount);
              return (
                <g key={node.id}>
                  <circle
                    className="taste-map-node-ring"
                    cx={node.x}
                    cy={node.y}
                    r={r + 12}
                    pointerEvents="none"
                  />
                  {selectedNodeId === node.id && (
                    <SelectionBracket cx={node.x ?? 0} cy={node.y ?? 0} half={r + 16} />
                  )}
                  <g onClick={(e) => handleCoreClick(e, node)}>
                    <VinylCenterLabel
                      cx={node.x ?? 0}
                      cy={node.y ?? 0}
                      r={r}
                      color={VINYL_LABEL_COLOR}
                      className="taste-map-node-core"
                      style={{ opacity: opacityFor(node), pointerEvents: "auto", transition: "opacity 350ms ease" }}
                      title={node.id}
                    />
                    <NodeLabel cx={node.x ?? 0} cy={(node.y ?? 0) + r + 8} text={node.id} />
                  </g>
                </g>
              );
            })}
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
