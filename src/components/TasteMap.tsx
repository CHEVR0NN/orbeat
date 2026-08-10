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
const ZOOM_SCALE = 2.6;

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t));
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
  const draggingId = useRef<string | null>(null);
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
    if (!draggingId.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const node = nodes.find((n) => n.id === draggingId.current);
    if (!node) return;
    node.fx = e.clientX - rect.left;
    node.fy = e.clientY - rect.top;
  }

  function handlePointerUp() {
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

  const zoomedAnchor = zoomedGalaxyId ? galaxyAnchors.get(zoomedGalaxyId) ?? null : null;
  const scale = zoomedAnchor ? ZOOM_SCALE : 1;
  const tx = zoomedAnchor ? WIDTH / 2 - scale * zoomedAnchor.x : 0;
  const ty = zoomedAnchor ? HEIGHT / 2 - scale * zoomedAnchor.y : 0;
  const sceneStyle = {
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    transformOrigin: "0 0",
    transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
  };

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
          <radialGradient id="taste-map-galaxy-disk" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(35, 229, 216, 0.22)" />
            <stop offset="55%" stopColor="rgba(232, 146, 232, 0.10)" />
            <stop offset="100%" stopColor="rgba(35, 229, 216, 0)" />
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
          <filter id="taste-map-disk-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          </filter>
        </defs>
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="url(#taste-map-bg)"
          onClick={() => setZoomedGalaxyId(null)}
        />
        <ellipse
          cx={WIDTH / 2}
          cy={HEIGHT / 2}
          rx={260}
          ry={95}
          transform={`rotate(-18 ${WIDTH / 2} ${HEIGHT / 2})`}
          fill="url(#taste-map-galaxy-disk)"
          filter="url(#taste-map-disk-blur)"
          pointerEvents="none"
          style={{
            opacity: zoomedGalaxyId ? 1 : 0,
            transition: "opacity 700ms ease",
          }}
        />
        <g style={sceneStyle}>
          {nodes.map((node) => {
            const isCore = node.kind === "core";
            const visible = isCore || zoomedGalaxyId === node.sourceCoreArtist;
            return (
              <g key={node.id}>
                {isCore && (
                  <circle
                    className="taste-map-node-ring"
                    cx={node.x}
                    cy={node.y}
                    r={radiusFor(node) + 12}
                    pointerEvents="none"
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radiusFor(node)}
                  className={isCore ? "taste-map-node-core" : "taste-map-node-candidate"}
                  fill={
                    isCore ? "url(#taste-map-node-core-fill)" : "url(#taste-map-node-candidate-fill)"
                  }
                  filter={isCore ? "url(#taste-map-glow-core)" : "url(#taste-map-glow-candidate)"}
                  style={{
                    opacity: visible ? opacityFor(node) : 0,
                    pointerEvents: visible ? "auto" : "none",
                    transition: "opacity 350ms ease, filter 200ms ease",
                  }}
                  onPointerDown={() => handlePointerDown(node)}
                  onClick={(e) => (isCore ? handleCoreClick(e, node) : handleCandidateClick(e, node))}
                >
                  <title>{node.id}</title>
                </circle>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
