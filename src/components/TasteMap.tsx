import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCollide,
  forceCenter,
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
  const [links, setLinks] = useState<SimLink[]>([]);
  const draggingId = useRef<string | null>(null);

  useEffect(() => {
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
      .force("charge", forceManyBody().strength(-120))
      .force("collide", forceCollide<SimNode>((d) => radiusFor(d) + 6))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2));

    simulation.on("tick", () => {
      setNodes([...simNodes]);
      setLinks([...simLinks]);
    });

    return () => {
      simulation.stop();
    };
  }, [graph]);

  function handlePointerDown(node: SimNode) {
    draggingId.current = node.id;
    node.fx = node.x;
    node.fy = node.y;
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
  }

  return (
    <svg
      className="taste-map"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <defs>
        <radialGradient id="taste-map-bg" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="var(--color-bg-inner)" />
          <stop offset="100%" stopColor="var(--color-bg-outer)" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="url(#taste-map-bg)" />
      {links.map((l, i) => {
        const source = l.source as SimNode;
        const target = l.target as SimNode;
        return (
          <line
            key={i}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            className="taste-map-link"
          />
        );
      })}
      {nodes.map((node) => (
        <circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={radiusFor(node)}
          className={node.kind === "core" ? "taste-map-node-core" : "taste-map-node-candidate"}
          opacity={opacityFor(node)}
          onPointerDown={() => handlePointerDown(node)}
          onClick={() => onSelectNode(node)}
        >
          <title>{node.id}</title>
        </circle>
      ))}
    </svg>
  );
}
