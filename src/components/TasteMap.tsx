import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from "react";
import { Star, Zap } from "lucide-react";
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

const GALAXY_SPARKLES = [
  { dx: -1.8, dy: -1.4, size: 6, delay: 0 },
  { dx: 1.6, dy: -0.9, size: 4, delay: 0.6 },
  { dx: -0.9, dy: 1.7, size: 5, delay: 1.2 },
  { dx: 1.5, dy: 1.3, size: 3.5, delay: 1.8 },
  { dx: -1.6, dy: 0.3, size: 3, delay: 0.9 },
];

function galaxySeed(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s += id.charCodeAt(i);
  return s % 360;
}

function sparklePath(s: number): string {
  return `M0,${-s} L${s * 0.22},${-s * 0.22} L${s},0 L${s * 0.22},${s * 0.22} L0,${s} L${-s * 0.22},${s * 0.22} L${-s},0 L${-s * 0.22},${-s * 0.22} Z`;
}

interface NodeShapeProps {
  cx: number;
  cy: number;
  r: number;
  color: string;
  className: string;
  style: CSSProperties;
  title: string;
}

function PlanetWithRings({ cx, cy, r, color, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <ellipse
        cx={cx}
        cy={cy}
        rx={r * 1.6}
        ry={r * 0.35}
        transform={`rotate(-18 ${cx} ${cy})`}
        fill="none"
        stroke="var(--accent-cyan)"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <circle cx={cx - r * 0.35} cy={cy - r * 0.2} r={r * 0.18} fill="#000" opacity={0.18} pointerEvents="none" />
      <circle cx={cx + r * 0.2} cy={cy + r * 0.32} r={r * 0.12} fill="#000" opacity={0.15} pointerEvents="none" />
      <ellipse cx={cx + r * 0.32} cy={cy - r * 0.28} rx={r * 0.14} ry={r * 0.08} fill="#000" opacity={0.12} pointerEvents="none" />
      <path
        d={`M ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} Z`}
        fill="#000"
        opacity={0.22}
        pointerEvents="none"
      />
      <g className="taste-map-node-moon" style={{ transformOrigin: `${cx}px ${cy}px` }} pointerEvents="none">
        <circle cx={cx + r * 1.9} cy={cy} r={Math.max(2, r * 0.2)} fill="var(--text-white)" opacity={0.85} />
      </g>
    </g>
  );
}

function starburstPath(s: number): string {
  return `M0,${-s} Q${s * 0.15},${-s * 0.15} ${s},0 Q${s * 0.15},${s * 0.15} 0,${s} Q${-s * 0.15},${s * 0.15} ${-s},0 Q${-s * 0.15},${-s * 0.15} 0,${-s} Z`;
}

function Starburst({ cx, cy, r, color, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <path d={starburstPath(r)} transform={`translate(${cx}, ${cy})`} fill={color} />
    </g>
  );
}

function CrescentMoon({ cx, cy, r, color, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <circle cx={cx + r * 0.45} cy={cy - r * 0.35} r={r * 0.85} fill="var(--bg-space)" pointerEvents="none" />
    </g>
  );
}

function PixelStarCluster({ cx, cy, r, color, className, style, title }: NodeShapeProps) {
  const s = Math.max(2, r * 0.5);
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <rect x={cx - s * 1.6} y={cy - s * 0.3} width={s} height={s} fill={color} />
      <rect x={cx + s * 0.5} y={cy - s * 1.3} width={s * 0.7} height={s * 0.7} fill={color} />
      <rect x={cx - s * 0.2} y={cy + s * 0.6} width={s * 0.6} height={s * 0.6} fill={color} />
      <circle cx={cx + s * 0.9} cy={cy + s * 0.9} r={s * 0.35} fill={color} />
    </g>
  );
}

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
  return {
    px: CANDIDATE_ORBIT_RADIUS * Math.cos(angle),
    py: CANDIDATE_ORBIT_RADIUS * Math.sin(angle),
  };
}

const ORBIT_TARGET_HALF_WIDTH = 320;
const ORBIT_SCALE_MIN = 1.4;
const ORBIT_SCALE_MAX = 3.4;

const FLAT_COLOR_CYCLE = [
  "var(--accent-cyan)",
  "var(--accent-yellow)",
  "var(--accent-pink)",
  "var(--accent-purple)",
];

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

  const orbitPlanets = zoomedGalaxyId
    ? nodes
        .filter((n) => ringIndexById.has(n.id))
        .map((node) => {
          const ringIndex = ringIndexById.get(node.id)!;
          const { px, py } = radialPosition(ringIndex, visibleCount);
          const color = FLAT_COLOR_CYCLE[ringIndex % 4];
          return {
            node,
            ringIndex,
            px,
            py,
            displayRadius: radiusFor(node),
            fill: color,
            hasPulse: ringIndex % 3 === 2,
          };
        })
        .sort((a, b) => a.ringIndex - b.ringIndex)
    : [];

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
            <stop offset="70%" stopColor="#0E0B16" />
          </radialGradient>
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
        <g className="taste-map-radar-grid" pointerEvents="none">
          <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={60} fill="none" className="taste-map-radar-ring" />
          <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={140} fill="none" className="taste-map-radar-ring" />
          <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={220} fill="none" className="taste-map-radar-ring" />
          <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={300} fill="none" className="taste-map-radar-ring" />
          <line x1={0} y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} className="taste-map-radar-crosshair" />
          <line x1={WIDTH / 2} y1={0} x2={WIDTH / 2} y2={HEIGHT} className="taste-map-radar-crosshair" />
        </g>
        <g style={sceneStyle}>
          {nodes
            .filter((node) => node.kind === "core")
            .map((node) => {
              const rank = coreRankById.get(node.id) ?? 0;
              const coreCount = coreRankById.size || 1;
              const r = coreRadiusFor(rank, coreCount);
              const seed = galaxySeed(node.id);
              return (
                <g key={node.id}>
                  <g transform={`translate(${node.x}, ${node.y}) rotate(${seed})`}>
                    {GALAXY_SPARKLES.map((sp, i) => (
                      <path
                        key={`sparkle-${i}`}
                        d={sparklePath(sp.size)}
                        transform={`translate(${r * sp.dx}, ${r * sp.dy})`}
                        className="taste-map-galaxy-sparkle"
                        style={{ animationDelay: `${sp.delay}s` }}
                        fill={i % 2 === 0 ? "#ffffff" : "var(--accent-yellow)"}
                        pointerEvents="none"
                      />
                    ))}
                  </g>
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
                    <PlanetWithRings
                      cx={node.x ?? 0}
                      cy={node.y ?? 0}
                      r={r}
                      color={FLAT_COLOR_CYCLE[rank % 4]}
                      className="taste-map-node-core"
                      style={{ opacity: opacityFor(node), pointerEvents: "auto", transition: "opacity 350ms ease" }}
                      title={node.id}
                    />
                    <NodeLabel cx={node.x ?? 0} cy={(node.y ?? 0) + r + 8} text={node.id} />
                  </g>
                </g>
              );
            })}
          {zoomedGalaxyId && zoomedAnchor && (
            <g transform={`translate(${zoomedAnchor.x}, ${zoomedAnchor.y})`}>
              {orbitPlanets.map(({ node, px, py }) => (
                <line
                  key={`link-${node.id}`}
                  x1={0}
                  y1={0}
                  x2={px}
                  y2={py}
                  className="taste-map-link-line"
                  pointerEvents="none"
                />
              ))}
              {orbitPlanets.map(
                ({ node, ringIndex, px, py, displayRadius, fill, hasPulse }) => {
                  const CandidateShape = ringIndex % 3 === 0 ? Starburst : ringIndex % 3 === 1 ? CrescentMoon : PixelStarCluster;
                  return (
                    <g key={`planet-${node.id}`}>
                      <g onClick={(e) => handleCandidateClick(e, node)}>
                        {selectedNodeId === node.id && (
                          <SelectionBracket cx={px} cy={py} half={displayRadius + 10} />
                        )}
                        <CandidateShape
                          cx={px}
                          cy={py}
                          r={displayRadius}
                          color={fill}
                          className={`taste-map-node-candidate${hasPulse ? " taste-map-node-pulse" : ""}`}
                          style={{ opacity: opacityFor(node), transition: "opacity 350ms ease" }}
                          title={node.id}
                        />
                        <NodeLabel cx={px} cy={py + displayRadius + 8} text={node.id} />
                      </g>
                    </g>
                  );
                }
              )}
            </g>
          )}
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
