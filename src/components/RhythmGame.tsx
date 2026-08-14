import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  generateNotes,
  judgeHit,
  applyJudgement,
  DIFFICULTIES,
  NOTE_COUNT,
  type GameNote,
  type GameState,
  type HitJudgement,
} from "../lib/rhythmGame";

type Phase = "picker" | "playing" | "end";
type DifficultyKey = keyof typeof DIFFICULTIES;

const DIFFICULTY_LABELS: Record<DifficultyKey, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

const JUDGEMENT_LABELS: Record<HitJudgement, string> = {
  perfect: "PERFECT",
  good: "GOOD",
  miss: "MISS",
};

// Note travel time from spawn (top of lane) to the hit zone. The rAF loop
// below mutates each note's DOM transform directly every frame instead of
// going through React state, matching the imperative-ref animation pattern
// used for orbiting nodes in TasteMap.tsx.
const FALL_DURATION_MS = 900;
const HIT_ZONE_OFFSET_PX = 280;

interface FlashState {
  judgement: HitJudgement;
  id: number;
}

const INITIAL_GAME_STATE: GameState = { score: 0, combo: 0, maxCombo: 0 };

export default function RhythmGame() {
  const [phase, setPhase] = useState<Phase>("picker");
  const [difficulty, setDifficulty] = useState<DifficultyKey>("normal");
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());
  const [flash, setFlash] = useState<FlashState | null>(null);

  const notesRef = useRef<GameNote[]>([]);
  const resolvedRef = useRef<Set<number>>(new Set());
  const startTimeRef = useRef(0);
  const noteElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const flashIdRef = useRef(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  function resolveNote(id: number, judgement: HitJudgement) {
    if (resolvedRef.current.has(id)) return;
    resolvedRef.current.add(id);
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setGameState((prev) => applyJudgement(prev, judgement));
    flashIdRef.current += 1;
    setFlash({ judgement, id: flashIdRef.current });
    if (resolvedRef.current.size === notesRef.current.length) {
      setPhase("end");
    }
  }

  function handlePress() {
    if (phase !== "playing") return;
    const elapsed = performance.now() - startTimeRef.current;
    let closest: GameNote | null = null;
    let closestDiff = Infinity;
    for (const note of notesRef.current) {
      if (resolvedRef.current.has(note.id)) continue;
      const diff = Math.abs(elapsed - note.hitTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = note;
      }
    }
    if (!closest) return;
    resolveNote(closest.id, judgeHit(closest.hitTime, elapsed));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.code === "Space") {
      e.preventDefault();
      handlePress();
    }
  }

  function startRound(chosen: DifficultyKey) {
    notesRef.current = generateNotes(NOTE_COUNT, DIFFICULTIES[chosen]);
    resolvedRef.current = new Set();
    setResolvedIds(new Set());
    setGameState(INITIAL_GAME_STATE);
    setFlash(null);
    setDifficulty(chosen);
    startTimeRef.current = performance.now();
    setPhase("playing");
  }

  useEffect(() => {
    if (phase === "playing") gameAreaRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    let frameId: number;
    const tick = () => {
      const elapsed = performance.now() - startTimeRef.current;
      for (const note of notesRef.current) {
        if (resolvedRef.current.has(note.id)) continue;
        if (elapsed > note.hitTime + 150) {
          resolveNote(note.id, "miss");
          continue;
        }
        const el = noteElsRef.current.get(note.id);
        if (el) {
          const ratio = (elapsed - (note.hitTime - FALL_DURATION_MS)) / FALL_DURATION_MS;
          el.style.transform = `translateY(${ratio * HIT_ZONE_OFFSET_PX}px)`;
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [phase]);

  if (phase === "picker") {
    return (
      <div className="rhythm-game-picker">
        <p className="rhythm-game-hint">Pick a difficulty to start.</p>
        <div className="rhythm-game-difficulty-row">
          {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className="rhythm-game-difficulty-btn"
              onClick={() => startRound(key)}
            >
              {DIFFICULTY_LABELS[key]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "end") {
    return (
      <div className="rhythm-game-end">
        <span className="rhythm-game-end-score">{gameState.score}</span>
        <span className="rhythm-game-end-label">final score</span>
        <span className="rhythm-game-end-combo">max combo {gameState.maxCombo}</span>
        <div className="rhythm-game-end-row">
          <button type="button" className="rhythm-game-difficulty-btn" onClick={() => startRound(difficulty)}>
            Play again
          </button>
          <button type="button" className="rhythm-game-difficulty-btn" onClick={() => setPhase("picker")}>
            Change difficulty
          </button>
        </div>
      </div>
    );
  }

  const visibleNotes = notesRef.current.filter((note) => !resolvedIds.has(note.id));

  return (
    <div
      className="rhythm-game-area"
      ref={gameAreaRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="rhythm-game-hud">
        <span className="rhythm-game-hud-score">{gameState.score}</span>
        <span className="rhythm-game-hud-combo">{gameState.combo} combo</span>
      </div>

      <div className="rhythm-game-lane">
        {flash && (
          <span key={flash.id} className={`rhythm-game-flash rhythm-game-flash-${flash.judgement}`}>
            {JUDGEMENT_LABELS[flash.judgement]}
          </span>
        )}
        {visibleNotes.map((note) => (
          <div
            key={note.id}
            className="rhythm-game-note"
            ref={(el) => {
              if (el) noteElsRef.current.set(note.id, el);
              else noteElsRef.current.delete(note.id);
            }}
          />
        ))}
        <button type="button" className="rhythm-game-hitzone" onClick={handlePress} aria-label="Hit zone">
          TAP
        </button>
      </div>
    </div>
  );
}
