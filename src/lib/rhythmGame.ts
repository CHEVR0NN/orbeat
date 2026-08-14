export interface GameNote {
  id: number;
  hitTime: number; // ms from game start
}

export const DIFFICULTIES = { easy: 90, normal: 120, hard: 150 };

export const NOTE_COUNT = 20;

export function generateNotes(count: number, bpm: number): GameNote[] {
  const beatMs = 60000 / bpm;
  const leadIn = 2 * beatMs;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    hitTime: leadIn + i * beatMs,
  }));
}

export type HitJudgement = "perfect" | "good" | "miss";

export function judgeHit(hitTime: number, pressTime: number): HitJudgement {
  const diff = Math.abs(pressTime - hitTime);
  if (diff <= 60) return "perfect";
  if (diff <= 150) return "good";
  return "miss";
}

export interface GameState {
  score: number;
  combo: number;
  maxCombo: number;
}

export function applyJudgement(state: GameState, judgement: HitJudgement): GameState {
  if (judgement === "miss") {
    return { ...state, combo: 0 };
  }
  const combo = state.combo + 1;
  const score = state.score + (judgement === "perfect" ? 300 : 100);
  return { score, combo, maxCombo: Math.max(state.maxCombo, combo) };
}
