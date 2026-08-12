import type { DeepCut } from "../lib/deepCuts";
import type { GraphNode } from "../types";

interface DeepCutsListProps {
  deepCuts: DeepCut[];
  onSelect: (node: GraphNode) => void;
}

export default function DeepCutsList({ deepCuts, onSelect }: DeepCutsListProps) {
  return (
    <aside className="deep-cuts-list">
      <h2>Deep Cuts</h2>
      {deepCuts.length === 0 ? (
        <p className="deep-cuts-list-empty">No deep cuts found yet — keep listening.</p>
      ) : (
        <ul className="deep-cuts-list-rows">
          {deepCuts.map((deepCut) => (
            <li key={deepCut.node.id}>
              <button
                type="button"
                className="deep-cuts-list-row"
                onClick={() => onSelect(deepCut.node)}
              >
                <span className="deep-cuts-list-row-name">{deepCut.node.id}</span>
                <span className="deep-cuts-list-row-reason">
                  Because you listen to {deepCut.node.sourceCoreArtist}
                </span>
                <span className="deep-cuts-list-row-meta">
                  {deepCut.node.match !== undefined && (
                    <span>{Math.round(deepCut.node.match * 100)}% similar</span>
                  )}
                  <span>{deepCut.node.listeners.toLocaleString()} listeners</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
