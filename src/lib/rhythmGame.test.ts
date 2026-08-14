import { describe, it, expect } from "vitest";
import { generateNotes, judgeHit, applyJudgement, DIFFICULTIES, NOTE_COUNT } from "./rhythmGame";

describe("generateNotes", () => {
  it("generates the requested count of notes", () => {
    const notes = generateNotes(5, 120);
    expect(notes).toHaveLength(5);
  });

  it("assigns sequential ids starting at 0", () => {
    const notes = generateNotes(4, 120);
    expect(notes.map((n) => n.id)).toEqual([0, 1, 2, 3]);
  });

  it("spaces notes by 60000/bpm ms", () => {
    const bpm = 120;
    const beatMs = 60000 / bpm;
    const notes = generateNotes(4, bpm);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].hitTime - notes[i - 1].hitTime).toBeCloseTo(beatMs);
    }
  });

  it("leads in with two beats before the first note", () => {
    const bpm = 90;
    const beatMs = 60000 / bpm;
    const notes = generateNotes(1, bpm);
    expect(notes[0].hitTime).toBeCloseTo(2 * beatMs);
  });
});

describe("judgeHit", () => {
  it("judges an exact hit as perfect", () => {
    expect(judgeHit(1000, 1000)).toBe("perfect");
  });

  it("judges a hit at exactly 60ms off as perfect", () => {
    expect(judgeHit(1000, 1060)).toBe("perfect");
    expect(judgeHit(1000, 940)).toBe("perfect");
  });

  it("judges a hit just past 60ms as good", () => {
    expect(judgeHit(1000, 1061)).toBe("good");
    expect(judgeHit(1000, 939)).toBe("good");
  });

  it("judges a hit at exactly 150ms off as good", () => {
    expect(judgeHit(1000, 1150)).toBe("good");
    expect(judgeHit(1000, 850)).toBe("good");
  });

  it("judges a hit just past 150ms as miss", () => {
    expect(judgeHit(1000, 1151)).toBe("miss");
    expect(judgeHit(1000, 849)).toBe("miss");
  });
});

describe("applyJudgement", () => {
  const initial = { score: 0, combo: 0, maxCombo: 0 };

  it("adds 300 score and increments combo on perfect", () => {
    const result = applyJudgement(initial, "perfect");
    expect(result).toEqual({ score: 300, combo: 1, maxCombo: 1 });
  });

  it("adds 100 score and increments combo on good", () => {
    const result = applyJudgement(initial, "good");
    expect(result).toEqual({ score: 100, combo: 1, maxCombo: 1 });
  });

  it("resets combo and leaves score unchanged on miss", () => {
    const state = { score: 500, combo: 3, maxCombo: 3 };
    const result = applyJudgement(state, "miss");
    expect(result).toEqual({ score: 500, combo: 0, maxCombo: 3 });
  });

  it("keeps maxCombo after a miss resets the current streak", () => {
    let state = { score: 0, combo: 0, maxCombo: 0 };
    state = applyJudgement(state, "perfect");
    state = applyJudgement(state, "perfect");
    state = applyJudgement(state, "perfect");
    expect(state.maxCombo).toBe(3);
    state = applyJudgement(state, "miss");
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(3);
  });

  it("does not mutate the input state", () => {
    const state = { score: 0, combo: 0, maxCombo: 0 };
    applyJudgement(state, "perfect");
    expect(state).toEqual({ score: 0, combo: 0, maxCombo: 0 });
  });
});

describe("constants", () => {
  it("exposes DIFFICULTIES bpm map", () => {
    expect(DIFFICULTIES).toEqual({ easy: 90, normal: 120, hard: 150 });
  });

  it("exposes a fixed NOTE_COUNT", () => {
    expect(NOTE_COUNT).toBe(20);
  });
});
