import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { Star, Zap } from "lucide-react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { Graph, GraphNode } from "../types";
import "./TasteMap.css";

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

const WIDTH = 900;
const HEIGHT = 640;
const MIN_RADIUS = 5;
const MAX_RADIUS = 30;
const MIN_OPACITY = 0.35;
const MAX_LINK_DISTANCE = 240;
const MIN_LINK_DISTANCE = 70;
const GALAXY_RADIUS = Math.min(WIDTH, HEIGHT) * 0.32;

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
      <path
        d={`M ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} Z`}
        fill="#000"
        opacity={0.22}
        pointerEvents="none"
      />
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

function SolidDot({ cx, cy, r, color, className, style, title }: NodeShapeProps) {
  return (
    <g className={className} style={style}>
      <title>{title}</title>
      <circle cx={cx} cy={cy} r={r} fill={color} />
    </g>
  );
}

const ORBIT_INNER_RX = 55;
const ORBIT_INNER_RY = 20;
const ORBIT_RING_STEP_RX = 26;
const ORBIT_RING_STEP_RY = 10;
const ORBIT_TILT_DEG = -20;
const ORBIT_GOLDEN_ANGLE_DEG = 137.5;
const ORBIT_TARGET_HALF_WIDTH = 320;
const ORBIT_SCALE_MIN = 1.4;
const ORBIT_SCALE_MAX = 3.4;
const ORBIT_AUTO_SPIN_BASE_DEG_PER_SEC = 14;

const XHTML_NS = { xmlns: "http://www.w3.org/1999/xhtml" };

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

function orbitRx(ringIndex: number): number {
  return ORBIT_INNER_RX + ringIndex * ORBIT_RING_STEP_RX;
}

function orbitRy(ringIndex: number): number {
  return ORBIT_INNER_RY + ringIndex * ORBIT_RING_STEP_RY;
}

function orbitPosition(ringIndex: number, angleOverrideDeg?: number): { px: number; py: number } {
  const angleDeg = angleOverrideDeg ?? (ringIndex * ORBIT_GOLDEN_ANGLE_DEG) % 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    px: orbitRx(ringIndex) * Math.cos(angleRad),
    py: orbitRy(ringIndex) * Math.sin(angleRad),
  };
}

function sizeJitter(ringIndex: number): number {
  return ((ringIndex * 37) % 9) - 4;
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
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [zoomedGalaxyId, setZoomedGalaxyId] = useState<string | null>(null);
  const [orbitAngleOverrides, setOrbitAngleOverrides] = useState<Map<string, number>>(new Map());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);
  const draggingOrbitId = useRef<string | null>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);

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

  function anchorForNode(node: SimNode): { x: number; y: number } {
    const coreId = node.kind === "core" ? node.id : node.sourceCoreArtist;
    return galaxyAnchors.get(coreId ?? "") ?? { x: WIDTH / 2, y: HEIGHT / 2 };
  }

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

    const simNodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = graph.links.map((l) => ({ ...l }));

    const simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => {
            const target = l.target as SimNode;
            return lerp(MAX_LINK_DISTANCE, MIN_LINK_DISTANCE, target.relevance);
          })
      )
      .force("charge", forceManyBody().strength(-55))
      .force("collide", forceCollide<SimNode>((d) => radiusFor(d) + 6))
      .force(
        "x",
        forceX<SimNode>((d) => anchorForNode(d).x).strength((d) => (d.kind === "core" ? 0.9 : 0.22))
      )
      .force(
        "y",
        forceY<SimNode>((d) => anchorForNode(d).y).strength((d) => (d.kind === "core" ? 0.9 : 0.22))
      );

    simulationRef.current = simulation;

    simulation.on("tick", () => {
      setNodes([...simNodes]);
    });

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, galaxyAnchors]);

  function handlePointerDown(node: SimNode) {
    draggingId.current = node.id;
    node.fx = node.x;
    node.fy = node.y;
    simulationRef.current?.alphaTarget(0.3).restart();
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (draggingOrbitId.current) {
      const orbitNodeId = draggingOrbitId.current;
      const ringIndex = ringIndexById.get(orbitNodeId);
      if (ringIndex === undefined || !zoomedAnchor) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const scaleToViewBox = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
      const letterboxX = (rect.width - WIDTH * scaleToViewBox) / 2;
      const letterboxY = (rect.height - HEIGHT * scaleToViewBox) / 2;
      const viewBoxX = (e.clientX - rect.left - letterboxX) / scaleToViewBox;
      const viewBoxY = (e.clientY - rect.top - letterboxY) / scaleToViewBox;

      const sceneX = (viewBoxX - tx) / scale;
      const sceneY = (viewBoxY - ty) / scale;

      const localX = sceneX - zoomedAnchor.x;
      const localY = sceneY - zoomedAnchor.y;

      const rad = (-ORBIT_TILT_DEG * Math.PI) / 180;
      const unrotX = localX * Math.cos(rad) - localY * Math.sin(rad);
      const unrotY = localX * Math.sin(rad) + localY * Math.cos(rad);

      const rx = orbitRx(ringIndex);
      const ry = orbitRy(ringIndex);
      const angleRad = Math.atan2(unrotY / ry, unrotX / rx);
      const angleDeg = (angleRad * 180) / Math.PI;

      setOrbitAngleOverrides((prev) => {
        const next = new Map(prev);
        next.set(orbitNodeId, angleDeg);
        return next;
      });
      return;
    }

    if (!draggingId.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const node = nodes.find((n) => n.id === draggingId.current);
    if (!node) return;
    node.fx = e.clientX - rect.left;
    node.fy = e.clientY - rect.top;
  }

  function handlePointerUp() {
    draggingOrbitId.current = null;

    if (!draggingId.current) return;
    const node = nodes.find((n) => n.id === draggingId.current);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    draggingId.current = null;
    simulationRef.current?.alphaTarget(0);
  }

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

  function handleOrbitPointerDown(e: PointerEvent<SVGGElement>, node: SimNode) {
    e.stopPropagation();
    draggingOrbitId.current = node.id;
  }

  useEffect(() => {
    if (!zoomedGalaxyId || ringIndexById.size === 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let rafId: number;
    let lastTime: number | null = null;

    function tick(time: number) {
      if (lastTime === null) lastTime = time;
      const deltaSeconds = (time - lastTime) / 1000;
      lastTime = time;

      setOrbitAngleOverrides((prev) => {
        const next = new Map(prev);
        ringIndexById.forEach((ringIndex, nodeId) => {
          if (draggingOrbitId.current === nodeId) return;
          const speed = ORBIT_AUTO_SPIN_BASE_DEG_PER_SEC / (1 + ringIndex * 0.4);
          const current = next.get(nodeId) ?? (ringIndex * ORBIT_GOLDEN_ANGLE_DEG) % 360;
          next.set(nodeId, (current + speed * deltaSeconds) % 360);
        });
        return next;
      });

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [zoomedGalaxyId, ringIndexById]);

  const zoomedAnchor = zoomedGalaxyId ? galaxyAnchors.get(zoomedGalaxyId) ?? null : null;
  const visibleCount = ringIndexById.size;
  const maxOrbitRx = visibleCount > 0 ? ORBIT_INNER_RX + (visibleCount - 1) * ORBIT_RING_STEP_RX : ORBIT_INNER_RX;
  const scale = zoomedAnchor
    ? clamp(ORBIT_TARGET_HALF_WIDTH / Math.max(maxOrbitRx, 1), ORBIT_SCALE_MIN, ORBIT_SCALE_MAX)
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
          const { px, py } = orbitPosition(ringIndex, orbitAngleOverrides.get(node.id));
          const color = FLAT_COLOR_CYCLE[ringIndex % 4];
          return {
            node,
            ringIndex,
            rx: orbitRx(ringIndex),
            ry: orbitRy(ringIndex),
            px,
            py,
            displayRadius: Math.max(4, radiusFor(node) + sizeJitter(ringIndex)),
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
      </div>
      <svg
        className="taste-map"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <radialGradient id="taste-map-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0)" />
            <stop offset="70%" stopColor="rgba(0, 0, 0, 0)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0.55)" />
          </radialGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="var(--bg-space)"
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
                  <g
                    onPointerDown={() => handlePointerDown(node)}
                    onClick={(e) => handleCoreClick(e, node)}
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() => setHoveredNodeId((id) => (id === node.id ? null : id))}
                  >
                    <PlanetWithRings
                      cx={node.x ?? 0}
                      cy={node.y ?? 0}
                      r={r}
                      color={FLAT_COLOR_CYCLE[rank % 4]}
                      className="taste-map-node-core"
                      style={{ opacity: opacityFor(node), pointerEvents: "auto", transition: "opacity 350ms ease" }}
                      title={node.id}
                    />
                    {(hoveredNodeId === node.id || selectedNodeId === node.id) && zoomedGalaxyId !== node.id && (
                      <foreignObject
                        x={(node.x ?? 0) - 85}
                        y={(node.y ?? 0) - r - 30}
                        width={170}
                        height={24}
                        pointerEvents="none"
                      >
                        <div {...XHTML_NS} className="taste-map-node-tooltip">
                          {node.id}
                        </div>
                      </foreignObject>
                    )}
                  </g>
                </g>
              );
            })}
          {zoomedGalaxyId && zoomedAnchor && (
            <g transform={`translate(${zoomedAnchor.x}, ${zoomedAnchor.y}) rotate(${ORBIT_TILT_DEG})`}>
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
              {orbitPlanets.map(({ node, rx, ry, ringIndex }) => (
                <ellipse
                  key={`ring-${node.id}`}
                  cx={0}
                  cy={0}
                  rx={rx}
                  ry={ry}
                  className="taste-map-orbit-ring"
                  style={{
                    opacity: lerp(0.32, 0.08, visibleCount > 1 ? ringIndex / (visibleCount - 1) : 0),
                  }}
                  pointerEvents="none"
                />
              ))}
              {orbitPlanets.map(
                ({ node, ringIndex, px, py, displayRadius, fill, hasPulse }) => {
                  const CandidateShape = ringIndex % 3 === 0 ? Starburst : ringIndex % 3 === 1 ? CrescentMoon : SolidDot;
                  return (
                    <g key={`planet-${node.id}`}>
                      <g
                        onPointerDown={(e) => handleOrbitPointerDown(e, node)}
                        onClick={(e) => handleCandidateClick(e, node)}
                        onPointerEnter={() => setHoveredNodeId(node.id)}
                        onPointerLeave={() => setHoveredNodeId((id) => (id === node.id ? null : id))}
                      >
                        <CandidateShape
                          cx={px}
                          cy={py}
                          r={displayRadius}
                          color={fill}
                          className={`taste-map-node-candidate${hasPulse ? " taste-map-node-pulse" : ""}`}
                          style={{ opacity: opacityFor(node), transition: "opacity 350ms ease" }}
                          title={node.id}
                        />
                        {(hoveredNodeId === node.id || selectedNodeId === node.id) && (
                          <g transform={`translate(${px}, ${py - displayRadius - 26}) rotate(${-ORBIT_TILT_DEG})`}>
                            <foreignObject x={-70} y={0} width={140} height={24} pointerEvents="none">
                              <div {...XHTML_NS} className="taste-map-node-tooltip">
                                {node.id}
                              </div>
                            </foreignObject>
                          </g>
                        )}
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
