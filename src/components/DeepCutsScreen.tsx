import type { DeepCut } from "../lib/deepCuts";

interface DeepCutsScreenProps {
  deepCuts: DeepCut[];
}

export default function DeepCutsScreen({ deepCuts }: DeepCutsScreenProps) {
  return (
    <section className="deep-cuts-screen">
      <p className="deep-cuts-screen-header">
        Deep Cuts — artists similar to your favorites but far less popular, ranked best match first
      </p>
      {deepCuts.length === 0 ? (
        <p className="deep-cuts-screen-empty">No deep cuts found yet — keep listening.</p>
      ) : (
        <div className="deep-cuts-screen-grid">
          {deepCuts.map((deepCut, index) => (
            <div className="deep-cuts-screen-card" key={deepCut.node.id}>
              <span className="deep-cuts-screen-card-rank">#{index + 1}</span>
              <span className="deep-cuts-screen-card-name">{deepCut.node.id}</span>
              <span className="deep-cuts-screen-card-reason">
                Because you listen to {deepCut.node.sourceCoreArtist}
              </span>
              <span className="deep-cuts-screen-card-meta">
                {deepCut.node.match !== undefined && <span>{Math.round(deepCut.node.match * 100)}% similar</span>}
                <span>{deepCut.node.listeners.toLocaleString()} listeners</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
