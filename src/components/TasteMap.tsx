import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
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

const GALAXY_WISPS = [
  { dx: -0.5, dy: -0.9, rxMul: 2.4, ryMul: 0.95, rot: -25, warm: false, opacity: 0.55 },
  { dx: 0.8, dy: 0.3, rxMul: 2.6, ryMul: 0.9, rot: 40, warm: true, opacity: 0.5 },
  { dx: -0.9, dy: 0.6, rxMul: 2.2, ryMul: 0.8, rot: 80, warm: false, opacity: 0.45 },
  { dx: 0.3, dy: -1.0, rxMul: 1.9, ryMul: 0.65, rot: -60, warm: true, opacity: 0.5 },
  { dx: -0.2, dy: 0.95, rxMul: 2.3, ryMul: 0.75, rot: 15, warm: false, opacity: 0.4 },
];

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

const ORBIT_INNER_RX = 55;
const ORBIT_INNER_RY = 20;
const ORBIT_RING_STEP_RX = 26;
const ORBIT_RING_STEP_RY = 10;
const ORBIT_TILT_DEG = -20;
const ORBIT_GOLDEN_ANGLE_DEG = 137.5;
const ORBIT_TARGET_HALF_WIDTH = 320;
const ORBIT_SCALE_MIN = 1.4;
const ORBIT_SCALE_MAX = 3.4;

const CANDIDATE_COLOR_CYCLE = [
  { gradientId: "taste-map-node-candidate-fill", accentVar: "var(--accent-pink)" },
  { gradientId: "taste-map-node-candidate-fill-yellow", accentVar: "var(--accent-yellow)" },
  { gradientId: "taste-map-node-candidate-fill-coral", accentVar: "var(--accent-coral)" },
  { gradientId: "taste-map-node-candidate-fill-teal", accentVar: "var(--accent-cyan)" },
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
        const angle = i * ((2 * Math.PI) / coreNodes.length) - Math.PI / 2;
        map.set(n.id, {
          x: centerX + GALAXY_RADIUS * Math.cos(angle),
          y: centerY + GALAXY_RADIUS * Math.sin(angle),
        });
      });
    }
    return map;
  }, [graph]);

  function anchorForNode(node: SimNode): { x: number; y: number } {
    const coreId = node.kind === "core" ? node.id : node.sourceCoreArtist;
    return galaxyAnchors.get(coreId ?? "") ?? { x: WIDTH / 2, y: HEIGHT / 2 };
  }

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

  function handleCoreClick(e: MouseEvent<SVGCircleElement>, node: SimNode) {
    e.stopPropagation();
    onSelectNode(node);
    setZoomedGalaxyId(node.id);
  }

  function handleCandidateClick(e: MouseEvent<SVGCircleElement>, node: SimNode) {
    e.stopPropagation();
    onSelectNode(node);
  }

  function handleOrbitPointerDown(e: PointerEvent<SVGCircleElement>, node: SimNode) {
    e.stopPropagation();
    draggingOrbitId.current = node.id;
  }

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
          const color = CANDIDATE_COLOR_CYCLE[ringIndex % 4];
          const style = ringIndex % 3;
          return {
            node,
            ringIndex,
            rx: orbitRx(ringIndex),
            ry: orbitRy(ringIndex),
            px,
            py,
            displayRadius: Math.max(4, radiusFor(node) + sizeJitter(ringIndex)),
            gradientId: color.gradientId,
            accentVar: color.accentVar,
            hasAccessory: style === 1,
            hasMoon: style === 2,
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
      <svg
        className="taste-map"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <radialGradient id="taste-map-bg" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="#241a3d" />
            <stop offset="100%" stopColor="var(--bg-space)" />
          </radialGradient>
          <radialGradient id="taste-map-node-core-fill" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="var(--accent-cyan)" />
            <stop offset="100%" stopColor="var(--bg-space-dark)" />
          </radialGradient>
          <radialGradient id="taste-map-node-candidate-fill" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="var(--accent-pink)" />
            <stop offset="100%" stopColor="var(--bg-space-dark)" />
          </radialGradient>
          <radialGradient id="taste-map-node-candidate-fill-yellow" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="var(--accent-yellow)" />
            <stop offset="100%" stopColor="var(--bg-space-dark)" />
          </radialGradient>
          <radialGradient id="taste-map-node-candidate-fill-coral" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="var(--accent-coral)" />
            <stop offset="100%" stopColor="var(--bg-space-dark)" />
          </radialGradient>
          <radialGradient id="taste-map-node-candidate-fill-teal" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="color-mix(in srgb, var(--accent-cyan) 55%, var(--bg-space-dark))" />
            <stop offset="100%" stopColor="var(--bg-space-dark)" />
          </radialGradient>
          <filter id="taste-map-glow-core" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="taste-map-glow-candidate" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="taste-map-galaxy-haze" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(35, 229, 216, 0.75)" />
            <stop offset="60%" stopColor="rgba(232, 146, 232, 0.4)" />
            <stop offset="100%" stopColor="rgba(35, 229, 216, 0)" />
          </radialGradient>
          <filter id="taste-map-galaxy-haze-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" />
          </filter>
          <radialGradient id="taste-map-galaxy-haze-warm" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 184, 48, 0.7)" />
            <stop offset="60%" stopColor="rgba(255, 73, 124, 0.38)" />
            <stop offset="100%" stopColor="rgba(255, 184, 48, 0)" />
          </radialGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="url(#taste-map-bg)"
          onClick={() => setZoomedGalaxyId(null)}
        />
        <g style={sceneStyle}>
          {nodes
            .filter((node) => node.kind === "core")
            .map((node) => (
              <g key={node.id}>
                {(() => {
                  const r = radiusFor(node);
                  const rot = galaxySeed(node.id);
                  return (
                    <g transform={`translate(${node.x}, ${node.y}) rotate(${rot})`}>
                      {GALAXY_WISPS.map((w, i) => (
                        <ellipse
                          key={`wisp-${i}`}
                          cx={r * w.dx}
                          cy={r * w.dy}
                          rx={r * w.rxMul}
                          ry={r * w.ryMul}
                          transform={`rotate(${w.rot} ${r * w.dx} ${r * w.dy})`}
                          fill={w.warm ? "url(#taste-map-galaxy-haze-warm)" : "url(#taste-map-galaxy-haze)"}
                          filter="url(#taste-map-galaxy-haze-blur)"
                          opacity={w.opacity}
                          pointerEvents="none"
                        />
                      ))}
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
                  );
                })()}
                <circle
                  className="taste-map-node-ring"
                  cx={node.x}
                  cy={node.y}
                  r={radiusFor(node) + 12}
                  pointerEvents="none"
                />
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radiusFor(node)}
                  className="taste-map-node-core"
                  fill="url(#taste-map-node-core-fill)"
                  filter="url(#taste-map-glow-core)"
                  style={{
                    opacity: opacityFor(node),
                    pointerEvents: "auto",
                    transition: "opacity 350ms ease, filter 200ms ease",
                  }}
                  onPointerDown={() => handlePointerDown(node)}
                  onClick={(e) => handleCoreClick(e, node)}
                >
                  <title>{node.id}</title>
                </circle>
              </g>
            ))}
          {zoomedGalaxyId && zoomedAnchor && (
            <g transform={`translate(${zoomedAnchor.x}, ${zoomedAnchor.y}) rotate(${ORBIT_TILT_DEG})`}>
              {orbitPlanets.map(({ node, rx, ry }) => (
                <ellipse
                  key={`ring-${node.id}`}
                  cx={0}
                  cy={0}
                  rx={rx}
                  ry={ry}
                  className="taste-map-orbit-ring"
                  pointerEvents="none"
                />
              ))}
              {orbitPlanets.map(({ node, px, py, displayRadius, gradientId, accentVar, hasAccessory, hasMoon }) => (
                <g key={`planet-${node.id}`}>
                  {hasAccessory && (
                    <g transform={`translate(${px}, ${py}) rotate(25)`}>
                      <ellipse
                        cx={0}
                        cy={0}
                        rx={radiusFor(node) * 1.7}
                        ry={radiusFor(node) * 0.5}
                        fill="none"
                        stroke={accentVar}
                        strokeWidth={1.5}
                        opacity={0.5}
                        pointerEvents="none"
                      />
                    </g>
                  )}
                  {hasMoon && (
                    <circle
                      cx={px + radiusFor(node) * 1.6}
                      cy={py - radiusFor(node) * 1.1}
                      r={radiusFor(node) * 0.28}
                      fill={`url(#${gradientId})`}
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    cx={px}
                    cy={py}
                    r={displayRadius}
                    className="taste-map-node-candidate"
                    fill={`url(#${gradientId})`}
                    filter="url(#taste-map-glow-candidate)"
                    style={{
                      opacity: opacityFor(node),
                      transition: "opacity 350ms ease, filter 200ms ease",
                    }}
                    onPointerDown={(e) => handleOrbitPointerDown(e, node)}
                    onClick={(e) => handleCandidateClick(e, node)}
                  >
                    <title>{node.id}</title>
                  </circle>
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
